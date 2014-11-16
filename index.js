'use strict';

var access = require('safe-access')
var pull = require('pull-stream')
var pullLevel = require('pull-level')
var _ = require('lodash')

var _db;
var _indexes;

module.exports = function (d, i) {
  _db = d
  _indexes = i

  return {
    putIndex: putIndex,
    read: read,
    makeRange: makeRange,
    makeIndexMsgs: makeIndexMsgs,
    makeIndexMsg: makeIndexMsg
  }
}


// ## llibrarian.put(key, value[, options][, callback])
// `key`: same as levelup
// `value`: same as levelup
// `options`: same as levelup, with the addition of 2 new options:
//   * `db`: this is the leveldb to use, it will override the db set
//     at initialization
//   * `indexes`: this is an array of indexes to create, it will override
//     the indexes set at initialization

function putIndex (key, value, options, callback) {
  var db = (options && options.db) || _db
  var indexes = (options && options.indexes) || _indexes

  db.batch(makeIndexMsgs({ key: key, value: value }, indexes), options, callback)
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

function read (index, query, options) {
  var db = (options && options.db) || _db
  options = _.extend(options || {}, makeRange(index, query))

  return pull(
    pullLevel.read(db, options),
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


// This function takes a message and an array of indexes
// and returns a batch of documents for createWriteStream
//
// var message = {
//   key: 'w32fwfw33',
//   value: {
//     timestamp: '29304857',
//     content: { id: 's1df34sa3df', flip: 'flop' }
//   }
// }
//
// var indexes = [ 'timestamp', 'content.id', [ 'content.id', 'timestamp' ]]
// ssailor.makeIndexMsgs(message, indexes)
//
// [
//   // Original message
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

function makeIndexMsgs (message, indexes) {
  var batch = [ message ];

  // Generate an index message for each index
  indexes.forEach(function (index) {
    batch.push(makeIndexMsg(message, index))
  })

  return batch
}

function makeIndexMsg (message, index) {
  // Make sure index is wrapped in array
  if (!Array.isArray(index)) { index = [ index ] }

  // Use access to turn the keystring into the
  // appropriate value(s) from the message
  var val = index.map(function (index) {
    return access(message.value, index)
  }).join('~')

  return {
      key: '~' + index.join(',') + '~' + val + '~',
      value: message.key
    }
}
