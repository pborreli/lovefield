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
goog.provide('lf.testing.index.TestSingleRowNumericalKey');

goog.require('goog.testing.jsunit');
goog.require('lf.index.KeyRange');
goog.require('lf.testing.index.TestIndex');



/**
 * @extends {lf.testing.index.TestIndex}
 * @constructor
 * @struct
 *
 * @param {!function():!lf.index.Index} constructorFn The function to call
 *     before every test case, in order to get a newly created index.
 */
lf.testing.index.TestSingleRowNumericalKey = function(constructorFn) {
  lf.testing.index.TestSingleRowNumericalKey.base(
      this, 'constructor', constructorFn);
};
goog.inherits(
    lf.testing.index.TestSingleRowNumericalKey,
    lf.testing.index.TestIndex);


/** @override */
lf.testing.index.TestSingleRowNumericalKey.prototype.testAddGet =
    function(index) {
  // Test add / get.
  for (var i = 0; i < 10; ++i) {
    var key = 10 + i;
    var value = 20 + i;
    index.add(key, value);
    var actualValue = index.get(key)[0];
    assertEquals(value, actualValue);
  }
};


/** @override */
lf.testing.index.TestSingleRowNumericalKey.prototype.testGetRangeCost =
    function(index) {
  this.populateIndex_(index);

  lf.testing.index.TestSingleRowNumericalKey.keyRanges.forEach(
      function(keyRange, counter) {
        var expectedResult = lf.testing.index.TestSingleRowNumericalKey.
            getRangeExpectations[counter];
        lf.testing.index.TestIndex.assertGetRangeCost(
            index, keyRange, expectedResult);
      });
};


/** @override */
lf.testing.index.TestSingleRowNumericalKey.prototype.testRemove =
    function(index) {
  this.populateIndex_(index);

  index.remove(12, 22);
  assertArrayEquals([], index.get(12));

  var keyRange = lf.index.KeyRange.only(12);
  assertArrayEquals([], index.getRange(keyRange));
  assertEquals(0, index.cost(keyRange));
};


/** @override */
lf.testing.index.TestSingleRowNumericalKey.prototype.testSet = function(index) {
  this.populateIndex_(index);
  index.remove(12, 22);
  assertEquals(9, index.getRange().length);

  for (var i = 0; i < 10; ++i) {
    var key = 10 + i;
    var value = 30 + i;
    index.set(key, value);
    var actualValue = index.get(key)[0];
    assertEquals(value, actualValue);
  }

  assertEquals(10, index.getRange().length);
};


/**
 * Populates the index with dummy data to be used for al tests.
 * @param {!lf.index.Index} index
 * @private
 */
lf.testing.index.TestSingleRowNumericalKey.prototype.populateIndex_ =
    function(index) {
  for (var i = 0; i < 10; ++i) {
    var key = 10 + i;
    var value = 20 + i;
    index.add(key, value);
  }
};


/**
 * The key ranges to be used for testing.
 * @type {!Array.<!lf.index.KeyRange|undefined>}
 */
lf.testing.index.TestSingleRowNumericalKey.keyRanges = [
  // get all.
  undefined,
  lf.index.KeyRange.all(),
  // get one key
  lf.index.KeyRange.only(15),
  // lower bound.
  lf.index.KeyRange.lowerBound(15),
  lf.index.KeyRange.lowerBound(15, true),
  // upper bound.
  lf.index.KeyRange.upperBound(15),
  lf.index.KeyRange.upperBound(15, true),
  // both lower and upper bound.
  new lf.index.KeyRange(12, 15, false, false),
  new lf.index.KeyRange(12, 15, true, false),
  new lf.index.KeyRange(12, 15, false, true),
  new lf.index.KeyRange(12, 15, true, true)
];


/**
 * The expected results for all key ranges in
 * lf.testing.index.TestSingleRowNumericalKeyCases.keyRanges.
 * @type {!Array.<!Array.<number>>}
 */
lf.testing.index.TestSingleRowNumericalKey.getRangeExpectations = [
  // get all.
  [20, 21, 22, 23, 24, 25, 26, 27, 28, 29],
  [20, 21, 22, 23, 24, 25, 26, 27, 28, 29],
  // get one key
  [25],
  // lower bound.
  [25, 26, 27, 28, 29],
  [26, 27, 28, 29],
  // upper bound.
  [20, 21, 22, 23, 24, 25],
  [20, 21, 22, 23, 24],
  // both lower and upper bound.
  [22, 23, 24, 25],
  [23, 24, 25],
  [22, 23, 24],
  [23, 24]
];
