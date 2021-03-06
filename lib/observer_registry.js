/**
 * @license
 * Copyright 2014 Google Inc. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
goog.provide('lf.ObserverRegistry');

goog.require('goog.asserts');
goog.require('goog.structs.Map');
goog.require('goog.structs.Set');

goog.forwardDeclare('lf.query.Select');
goog.forwardDeclare('lf.query.SelectBuilder');



/**
 * A class responsible for keeping track of all observers as well as all arrays
 * that are being observed.
 * @constructor
 */
lf.ObserverRegistry = function() {
  /**
   * A map where each entry represents an observed query.
   * @private {!goog.structs.Map.<string, !lf.ObserverRegistry.Entry_>}
   */
  this.entries_ = new goog.structs.Map();
};


/**
 * @param {!lf.query.SelectContext} query
 * @return {string} A unique ID of the given query.
 * @private
 */
lf.ObserverRegistry.prototype.getQueryId_ = function(query) {
  return goog.getUid(query).toString();
};


/**
 * Registers an observer for the given query.
 * @param {!lf.query.Select} builder The query to be observed.
 * @param {!Function} callback The callback to be called whenever the results of
 *     the given query are modified.
 */
lf.ObserverRegistry.prototype.addObserver = function(builder, callback) {
  var query = /** @type {!lf.query.SelectBuilder} */ (builder).getQuery();
  var queryId = this.getQueryId_(query);

  var entry = this.entries_.get(queryId, null);
  if (goog.isNull(entry)) {
    entry = new lf.ObserverRegistry.Entry_(query);
    this.entries_.set(queryId, entry);
  }
  entry.addObserver(callback);
};


/**
 * Unregisters an observer for the given query.
 * @param {!lf.query.Select} builder The query to be unobserved.
 * @param {!Function} callback The callback to be unregistered.
 */
lf.ObserverRegistry.prototype.removeObserver = function(builder, callback) {
  var query = /** @type {!lf.query.SelectBuilder} */ (builder).getQuery();
  var queryId = this.getQueryId_(query);

  var entry = this.entries_.get(queryId, null);
  goog.asserts.assert(
      goog.isDefAndNotNull(entry),
      'Attempted to unobserve a query that was not observed.');
  var didRemove = entry.removeObserver(callback);
  goog.asserts.assert(
      didRemove,
      'removeObserver: Inconsistent state detected.');

  if (!entry.hasObservers()) {
    this.entries_.remove(queryId);
  }
};


/**
 * Finds all the observed queries that reference at least one of the given
 * tables.
 * @param {!Array.<!lf.schema.Table>} tables
 * @return {!Array.<!lf.query.SelectContext>}
 */
lf.ObserverRegistry.prototype.getQueriesForTables = function(tables) {
  var tableSet = new goog.structs.Set();
  tables.forEach(function(table) {
    tableSet.add(table.getName());
  });

  var queries = [];
  this.entries_.getValues().forEach(
      function(entry) {
        var query = entry.getQuery();
        var refersToTables = query.from.some(
            function(table) {
              return tableSet.contains(table.getName());
            });
        if (refersToTables) {
          queries.push(query);
        }
      });
  return queries;
};


/**
 * Updates the results of a given query. It is ignored if the query is no longer
 * being observed or if the results have already been reported to observers.
 * @param {!lf.query.SelectContext} query
 * @param {!lf.proc.Relation} results The new results.
 * @return {boolean} Whether any results were updated.
 */
lf.ObserverRegistry.prototype.updateResultsForQuery = function(query, results) {
  var queryId = this.getQueryId_(query);
  var entry = this.entries_.get(queryId, null);

  if (!goog.isNull(entry) &&
      entry.lastResultVersion_ != query.currentVersion) {
    entry.updateResults(results);
    return true;
  }

  return false;
};



/**
 * @constructor
 * @private
 *
 * @param {!lf.query.SelectContext} query
 */
lf.ObserverRegistry.Entry_ = function(query) {
  /** @private {!lf.query.SelectContext} */
  this.query_ = query;

  /** @private {!goog.structs.Set<!Function>} */
  this.observers_ = new goog.structs.Set();

  /** @private {!Array<?>} */
  this.observableResults_ = [];

  /** @private {number} */
  this.lastResultVersion_ = -1;
};


/**
 * @param {!Function} callback
 */
lf.ObserverRegistry.Entry_.prototype.addObserver = function(callback) {
  if (this.observers_.contains(callback)) {
    goog.asserts.fail('Attempted to register observer twice.');
    return;
  }

  Array.observe(this.observableResults_, callback);
  this.observers_.add(callback);
};


/**
 * @param {!Function} callback
 * @return {boolean} Whether the callback was found and removed.
 */
lf.ObserverRegistry.Entry_.prototype.removeObserver = function(callback) {
  Array.unobserve(this.observableResults_, callback);
  return this.observers_.remove(callback);
};


/** @return {!Array.<?>} */
lf.ObserverRegistry.Entry_.prototype.getResult = function() {
  return this.observableResults_;
};


/** @return {!lf.query.SelectContext} */
lf.ObserverRegistry.Entry_.prototype.getQuery = function() {
  return this.query_;
};


/**
 * @return {boolean} Whether this query has any registered observers.
 */
lf.ObserverRegistry.Entry_.prototype.hasObservers = function() {
  return this.observers_.getCount() > 0;
};


/**
 * Updates the results for this query, which causes observes to be notified.
 * @param {!lf.proc.Relation} newResults The new results.
 */
lf.ObserverRegistry.Entry_.prototype.updateResults = function(newResults) {
  lf.ObserverRegistry.Entry_.applyDiff_(
      this.query_.columns, this.observableResults_, newResults);
  this.lastResultVersion_ = this.query_.currentVersion;
};


/**
 * Detects changes (additions/modifications/deletions) and applies them to the
 * observed array.
 * @param {!Array<!lf.schema.Column>} columns The columns included in each
 *     entry.
 * @param {!Array<?>} observableResults The array holding the last results. This
 *     is the array that is directly being observed by observers.
 * @param {!lf.proc.Relation} newResults The new results.
 * @private
 */
lf.ObserverRegistry.Entry_.applyDiff_ = function(
    columns, observableResults, newResults) {
  // TODO(dpapad): This is a dummy implementation that
  //  1) Blindly removes any existing contents from the array.
  //  2) Adds all new results to the observed array.
  // Modify this logic to properly detect additions/modifications/deletions.
  observableResults.length = 0;

  for (var i = 0; i < newResults.entries.length; i++) {
    observableResults.push(newResults.entries[i].row.payload());
  }
};
