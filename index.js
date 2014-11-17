'use strict';

var access = require('safe-access')
var pull = require('pull-stream')
var pl = require('pull-level')
var _ = require('lodash')

var db;
var indexes;

module.exports = function (d, i) {
  db = d
  indexes = i

  db.putWithIndex = putWithIndex
  db.readFromIndex = readFromIndex
  db.makeRange = makeRange
  db.makeIndexDocs = makeIndexDocs
  db.makeIndexDoc = makeIndexDoc
  db.indexes = indexes

  return db
}


// ## llibrarian.put(key, value[, options][, callback])
// `key`: same as levelup
// `value`: same as levelup
// `options`: same as levelup, with the addition of 2 new options:
//   * `db`: this is the leveldb to use, it will override the db set
//     at initialization
//   * `indexes`: this is an array of indexes to create, it will override
//     the indexes set at initialization

function putWithIndex (key, value, options, callback) {
  var _indexes = (options && options.indexes) || indexes

  db.batch(makeIndexDocs({ key: key, value: value }, _indexes), options, callback)
}


// This function takes a doc and an array of indexes
// and returns a batch of documents for createWriteStream
//
// var doc = {
//   key: 'w32fwfw33',
//   value: {
//     timestamp: '29304857',
//     content: { id: 's1df34sa3df', flip: 'flop' }
//   }
// }
//
// var indexes = [ 'timestamp', 'content.id', [ 'content.id', 'timestamp' ]]
// ssailor.makeIndexDocs(doc, indexes)
//
// [
//   // Original doc
//   {
//     key: 'w32fwfw33',
//     value: {
//       timestamp: '29304857',
//       content: { id: 's1df34sa3df', flip: 'flop' }
//     }
//   },
//
//   // Index documents
//   { key: '~timestamp~29304857~', value: 'w32fwfw33' },
//   { key: '~content.id~s1df34sa3df~', value: 'w32fwfw33' },
//   { key: '~content.id,timestamp~s1df34sa3df~29304857~' }
// ]

function makeIndexDocs (doc, indexes) {
  var batch = [];

  // Generate an index doc for each index
  indexes.forEach(function (index) {
    batch.push(makeIndexDoc(doc, index))
  })

  doc.value = JSON.stringify(doc.value)
  doc.type = 'put'
  batch.push(doc)

  return batch
}

function makeIndexDoc (doc, index) {
  // Make sure index is wrapped in array
  if (!Array.isArray(index)) { index = [ index ] }

  // Use access to turn the keystring into the
  // appropriate value(s) from the doc
  var val = index.map(function (index) {
    return access(doc.value, index)
  }).join('~')

  return {
      key: '~' + index.join(',') + '~' + val + '~',
      value: doc.key,
      type: 'put'
    }
}


// ## llibrarian.read(db, index, query)
// `index`: index definition (same format as supplied in 'indexes' init option)
// `query`: query matching the index definition.
// `options`: same as levelup, with the addition of 2 new options:
//   * `db`: this is the leveldb to use, it will override the db set
//     at initialization
//   * `tail`: this comes from pull-level, and will keep the stream open for
//     realtime changes
//
// Note: the `gt`, `gte`, `lt`, and `lte` options will not work, as they are
// generated automatically by level-librarian

function readFromIndex (index, query, options) {
  options = _.extend(options || {}, makeRange(index, query))

  return pull(
    pl.read(db, options),
    pull.asyncMap(function (data, callback) {
      db.get(data.value, function (value) {
        callback(null, { key: data.value, value: value })
      })
    })
  )
}


// This function takes an index and a query and returns
// a gte/lte query to be passed to levelUp.createReadStream()

// llibrarian.makeRange(['content.id', 'timestamp'], ['s1df34sa3df', ['29304857', '29304923']])
// { gte: '~content.id,timestamp~s1df34sa3df~29304857~',
//   lte: '~content.id,timestamp~s1df34sa3df~29304923~' }

// llibrarian.makeRange(['content.id', 'timestamp'], ['s1df34sa3df', '29304857'])
// { gte: '~content.id,timestamp~s1df34sa3df~29304857~',
//   lte: '~content.id,timestamp~s1df34sa3df~29304857~' }

// llibrarian.makeRange('timestamp', ['29304857', '29304923'])
// { gte: '~timestamp~29304857~',
//   lte: '~timestamp~29304923~' }

// llibrarian.makeRange('timestamp', '29304857')
// { gte: '~timestamp~29304857~',
//   lte: '~timestamp~29304857~' }

function makeRange (index, query) {
  if (!Array.isArray(query)) { query = [ query ] }

  var gte = []
  var lte = []

  query = query.forEach(function (item) {
    if (!Array.isArray(item)) { item = [ item ] }

    gte.push(item[0])
    lte.push(item[1] || item[0])
  })

  return {
    gte: '~' + index.join(',') + '~' + gte.join('~') + '~',
    lte: '~' + index.join(',') + '~' + lte.join('~') + '~'
  }
}
