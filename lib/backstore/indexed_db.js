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
goog.provide('lf.backstore.IndexedDB');

goog.require('goog.Promise');
goog.require('goog.log');
goog.require('lf.BackStore');
goog.require('lf.Exception');
goog.require('lf.Row');
goog.require('lf.TransactionType');
goog.require('lf.backstore.IndexedDBRawBackStore');
goog.require('lf.backstore.IndexedDBTx');
goog.require('lf.backstore.Page');

goog.forwardDeclare('goog.debug.Logger');



/**
 * IndexedDB-backed back store.
 *
 * The backstore supports "Bundle Mode", which will bundle 2^BUNDLE_EXPONENT
 * logical rows into a physical row (called bundled page) and store it in DB.
 * The reason behind this is to workaround IndexedDB spec design flaw in loading
 * large tables. Say one wanted to load all rows from table, the implementation
 * based on current spec is
 *
 * var req = objectStore.openCursor();
 * req.onsuccess = function() {
 *   if (cursor) {
 *     // get one row by using cursor.value
 *     cursor.continue();
 *   } else {
 *     // finished
 *   }
 * };
 *
 * Which involves N calls of cursor.continue and N eventing of onsuccess. This
 * is very expensive when N is big. WebKit needs 57us for firing an event on an
 * HP Z620, and the wall clock time for loading 100K rows will be 5.7s just for
 * firing N onsuccess events.
 *
 * As a result, the bundle mode is created to bundle many rows into a physical
 * row to workaround overhead caused by number of rows.
 *
 * @param {!lf.schema.Database} schema
 * @param {boolean=} opt_bundleMode Enable bundle mode, default to false.
 * @constructor
 * @struct
 * @final
 * @implements {lf.BackStore}
 */
lf.backstore.IndexedDB = function(schema, opt_bundleMode) {
  /** @private {!lf.schema.Database} */
  this.schema_ = schema;

  /** @private {!IDBDatabase} */
  this.db_;

  /** @private {goog.debug.Logger} */
  this.logger_ = goog.log.getLogger('lf.backstore.IndexedDB');

  /** @private {boolean} */
  this.bundleMode_ = opt_bundleMode || false;
};


/** @override */
lf.backstore.IndexedDB.prototype.init = function(opt_onUpgrade) {
  var indexedDB =
      window.indexedDB ||
      window.mozIndexedDB ||
      window.webkitIndexedDB ||
      window.msIndexedDB;
  if (!goog.isDefAndNotNull(indexedDB)) {
    throw new lf.Exception(lf.Exception.Type.NOT_SUPPORTED,
        'IndexedDB not supported by platform.');
  }

  var onUpgrade = opt_onUpgrade || function(rawDb) {
    return goog.Promise.resolve();
  };

  return new goog.Promise(function(resolve, reject) {
    var request;
    try {
      request = indexedDB.open(
          this.schema_.getName(), this.schema_.getVersion());
    } catch (e) {
      reject(e);
      return;
    }

    // Event sequence for IndexedDB database upgrade:
    // indexedDB.open found version mismatch
    //   --> onblocked (maybe, see http://www.w3.org/TR/IndexedDB 3.3.7)
    //   --> onupgradeneeded (when IndexedDB is ready to handle the connection)
    //   --> onsuccess
    // As a result the onblocked event is not handled delibrately.
    request.onerror = reject;
    request.onupgradeneeded = goog.bind(function(ev) {
      this.onUpgradeNeeded_(onUpgrade, ev).then(
          function() {},
          goog.bind(function(e) {
            goog.log.error(this.logger_, 'onUpgradeNeeded failed: ' + e);
            // The following call to reject() might be ignored if the IDB
            // transaction has been closed prematurely, because this promise
            // will have (erroneously) already resolved within onsuccess below.
            reject(e);
          }, this));
    }, this);
    request.onsuccess = goog.bind(function(ev) {
      this.db_ = ev.target.result;
      this.scanRowId_().then(goog.bind(function(rowId) {
        lf.Row.setNextId(rowId + 1);
        resolve(this.db_);
      }, this));
    }, this);
  }, this);
};


/**
 * @param {!function(!lf.raw.BackStore):!IThenable} onUpgrade
 * @param {!IDBVersionChangeEvent} ev
 * @return {!IThenable}
 * @private
 */
lf.backstore.IndexedDB.prototype.onUpgradeNeeded_ = function(onUpgrade, ev) {
  var db = ev.target.result;
  var tx = ev.target.transaction;
  var rawDb = new lf.backstore.IndexedDBRawBackStore(
      ev.oldVersion, db, tx, this.bundleMode_);
  this.createTables_(db);
  return onUpgrade(rawDb);
};


/**
 * Creates tables if they had not existed on the database.
 * @param {!IDBDatabase} db
 * @private
 */
lf.backstore.IndexedDB.prototype.createTables_ = function(db) {
  var schemaTables = this.schema_.getTables().map(function(table) {
    return table.getName();
  });
  for (var i = 0; i < schemaTables.length; ++i) {
    if (!db.objectStoreNames.contains(schemaTables[i])) {
      db.createObjectStore(schemaTables[i], {keyPath: 'id'});
    }
  }
};


/** @override */
lf.backstore.IndexedDB.prototype.createTx = function(
    type, journal) {
  var scope = journal.getScope().getValues().map(
      function(table) {
        return table.getName();
      });
  var nativeTx = this.db_.transaction(scope,
      type == lf.TransactionType.READ_ONLY ? 'readonly' : 'readwrite');
  return new lf.backstore.IndexedDBTx(
      nativeTx, journal, type, this.bundleMode_);
};


/**
 * Scans existing database and find the maximum row id.
 * @param {!IDBTransaction=} opt_tx
 * @return {!IThenable.<number>}
 * @private
 */
lf.backstore.IndexedDB.prototype.scanRowId_ = function(opt_tx) {
  var tableNames = this.schema_.getTables().map(function(table) {
    return table.getName();
  });

  var db = this.db_;
  var maxRowId = 0;

  /**
   * @param {!IDBCursor} cursor
   * @return {number} Max row id
   */
  var extractRowId = goog.bind(function(cursor) {
    if (this.bundleMode_) {
      var page = lf.backstore.Page.deserialize(cursor.value);
      return goog.object.getKeys(page.getPayload()).reduce(function(prev, cur) {
        return Math.max(prev, cur);
      }, 0);
    }

    return cursor.key;
  }, this);

  /**
   * @param {string} tableName
   * @return {!IThenable}
   */
  var scanTableRowId = goog.bind(function(tableName) {
    return new goog.Promise(function(resolve, reject) {
      var req;
      try {
        var tx = opt_tx || db.transaction([tableName]);
        req = tx.objectStore(tableName).openCursor(null, 'prev');
      } catch (e) {
        goog.log.error(this.logger_, 'scanRowId failed: ' + e);
        reject(e);
        return;
      }
      req.onsuccess = function(ev) {
        var cursor = ev.target.result;
        if (cursor) {
          maxRowId = Math.max(maxRowId, extractRowId(cursor));
          cursor.continue();
        }
        resolve(maxRowId);
      };
      req.onerror = function() {
        resolve(maxRowId);
      };
    }, this);
  }, this);

  /** @return {!IThenable} */
  var execSequentially = function() {
    if (tableNames.length == 0) {
      return goog.Promise.resolve();
    }

    var tableName = tableNames.shift();
    return scanTableRowId(tableName).then(execSequentially);
  };

  return new goog.Promise(function(resolve, reject) {
    execSequentially().then(function() {
      resolve(maxRowId);
    });
  });
};


/** @override */
lf.backstore.IndexedDB.prototype.close = function() {
  this.db_.close();
};
