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
goog.provide('lf.query.BaseBuilder');

goog.require('goog.Promise');
goog.require('lf.Global');
goog.require('lf.pred.ValuePredicate');
goog.require('lf.proc.UserQueryTask');
goog.require('lf.query.Builder');
goog.require('lf.service');
goog.require('lf.tree');



/**
 * @template Context
 * @constructor
 * @implements {lf.query.Builder}
 * @struct
 */
lf.query.BaseBuilder = function() {
  /** @private {!lf.proc.QueryEngine} */
  this.queryEngine_ = lf.Global.get().getService(lf.service.QUERY_ENGINE);

  /** @type {!Context} */
  this.query;

  /** @private {!lf.proc.Runner} */
  this.runner_ = lf.Global.get().getService(lf.service.RUNNER);
};


/** @override */
lf.query.BaseBuilder.prototype.exec = function() {
  try {
    this.assertExecPreconditions();
  } catch (e) {
    return goog.Promise.reject(e);
  }

  return new goog.Promise(function(resolve, reject) {
    var queryTask = new lf.proc.UserQueryTask([this.query]);
    this.runner_.scheduleTask(queryTask).then(
        function(results) {
          resolve(results[0].getPayloads());
        }, reject);
  }, this);
};


/** @override */
lf.query.BaseBuilder.prototype.explain = function() {
  return lf.tree.toString(this.queryEngine_.getPlan(this.query).getRoot());
};


/** @override */
lf.query.BaseBuilder.prototype.bind = function(values) {
  return this;
};


/**
 * Asserts whether the preconditions for executing this query are met. Should be
 * overriden by subclasses.
 * @throws {!lf.Exception}
 */
lf.query.BaseBuilder.prototype.assertExecPreconditions = function() {
  // No-op default implementation.
};


/**
 * @return {!Context}
 */
lf.query.BaseBuilder.prototype.getQuery = function() {
  return this.query;
};


/**
 * @param {!lf.query.SelectContext|
 *         !lf.query.UpdateContext|
 *         !lf.query.DeleteContext} context
 * @param {!Array.<*>} values
 * @protected
 */
lf.query.BaseBuilder.bindValuesInSearchCondition = function(context, values) {
  var searchCondition =
      /** @type {?lf.pred.PredicateNode} */ (context.where);
  if (goog.isDefAndNotNull(searchCondition)) {
    searchCondition.traverse(function(node) {
      if (node instanceof lf.pred.ValuePredicate) {
        node.bind(values);
      }
    });
  }
};
