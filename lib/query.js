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
goog.provide('lf.query');
goog.provide('lf.query.Builder');
goog.provide('lf.query.Delete');
goog.provide('lf.query.Insert');
goog.provide('lf.query.Select');
goog.provide('lf.query.Update');

goog.require('lf.Global');
goog.require('lf.service');

goog.forwardDeclare('lf.Order');
goog.forwardDeclare('lf.Type');


/**
 * Registers an observer for the given query.
 * @param {!lf.query.Select} query The query to be observed.
 * @param {!Function} callback The callback to be called whenever the results of
 *     the given query are modified.
 * @export
 */
lf.query.observe = function(query, callback) {
  var observerRegistry = lf.Global.get().getService(
      lf.service.OBSERVER_REGISTRY);
  observerRegistry.addObserver(query, callback);
};


/**
 * Unregisters an observer for the given query.
 * @param {!lf.query.Select} query The query to be unobserved.
 * @param {!Function} callback The callback to be unregistered.
 * @export
 */
lf.query.unobserve = function(query, callback) {
  var observerRegistry = lf.Global.get().getService(
      lf.service.OBSERVER_REGISTRY);
  observerRegistry.removeObserver(query, callback);
};



/** @interface */
lf.query.Builder = function() {};


/**
 * Executes the query, all errors will be passed to the reject function as
 * DOMException.
 * @return {!IThenable}
 */
lf.query.Builder.prototype.exec;


/** @return {?string} */
lf.query.Builder.prototype.explain;


/**
 * @param {!Array.<*>} values
 * @return {!lf.query.Builder}
 */
lf.query.Builder.prototype.bind;



/**
 * @extends {lf.query.Builder}
 * @interface
 */
lf.query.Select = function() {};


/**
 * @param {...lf.schema.Table} var_args
 * @return {!lf.query.Select}
 * @throws {DOMException}
 */
lf.query.Select.prototype.from;


/**
 * @param {!lf.Predicate} predicate
 * @return {!lf.query.Select}
 * @throws {DOMException}
 */
lf.query.Select.prototype.where;


/**
 * @param {!lf.schema.Table} table
 * @param {!lf.Predicate} predicate
 * @return {!lf.query.Select}
 * @throws {DOMException}
 */
lf.query.Select.prototype.innerJoin;


/**
 * @param {!lf.schema.Table} table
 * @return {!lf.query.Select}
 * @throws {DOMException}
 */
lf.query.Select.prototype.leftOuterJoin;


/**
 * @param {number} numberOfRows
 * @return {!lf.query.Select}
 */
lf.query.Select.prototype.limit;


/**
 * @param {number} numberOfRows
 * @return {!lf.query.Select}
 */
lf.query.Select.prototype.skip;


/**
 * @param {!lf.schema.Column} column
 * @param {lf.Order=} opt_order
 * @return {!lf.query.Select}
 * @throws {DOMException}
 */
lf.query.Select.prototype.orderBy;


/**
 * @param {!lf.schema.Column} column
 * @return {!lf.query.Select}
 * @throws {DOMException}
 */
lf.query.Select.prototype.groupBy;



/**
 * @extends {lf.query.Builder}
 * @interface
 */
lf.query.Insert = function() {};


/**
 * @param {!lf.schema.Table} table
 * @return {!lf.query.Insert}
 */
lf.query.Insert.prototype.into;


/**
 * @param {!Array.<!lf.Row>} rows
 * @return {!lf.query.Insert}
 * @throws {DOMException}
 */
lf.query.Insert.prototype.values;



/**
 * @extends {lf.query.Builder}
 * @interface
 */
lf.query.Update = function() {};


/**
 * @param {!lf.schema.Column} column
 * @param {*} value
 * @return {!lf.query.Update}
 * @throws {DOMException}
 */
lf.query.Update.prototype.set;


/**
 * @param {!lf.Predicate} predicate
 * @return {!lf.query.Update}
 * @throws {DOMException}
 */
lf.query.Update.prototype.where;



/**
 * @extends {lf.query.Builder}
 * @interface
 */
lf.query.Delete = function() {};


/**
 * @param {!lf.schema.Table} table
 * @return {!lf.query.Delete}
 */
lf.query.Delete.prototype.from;


/**
 * @param {!lf.Predicate} predicate
 * @return {!lf.query.Delete}
 * @throws {DOMException}
 */
lf.query.Delete.prototype.where;
