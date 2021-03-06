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
goog.provide('lf.testing.util');

goog.require('goog.Promise');


/**
 * Executes a list of asynchronous functions in a serial manner, such that only
 * one function is being executed at any given time.
 * @param {!Array.<!function():!IThenable>} functions The functions to be
 *     executed.
 * @return {!IThenable} A deferred holding the results of each executed function
 *     in the same order.
 */
lf.testing.util.sequentiallyRun = function(functions) {
  var resolver = goog.Promise.withResolver();

  var results = new Array(functions.length);
  var i = 0;
  var runner = function() {
    functions[i]().then(function(result) {
      results[i] = result;
      if (i < functions.length - 1) {
        i++;
        runner();
      } else {
        resolver.resolve();
      }
    }, function(e) {
      resolver.reject(e);
    });
  };

  runner();
  return resolver.promise;
};
