'use strict';

var access = require('safe-access')
var pull = require('pull-stream')
var pl = require('pull-level')
var merge = require('lodash/object/merge')
var compact = require('lodash/array/compact')
var reduce = require('lodash/collection/reduce')
var peek = require('level-peek')
var stringify = require('stable-stringify')
var tc = require('type-check').typeCheck;

module.exports = {
  read: read,
  readOne: makeReadOne(read),
  makeReadOne: makeReadOne,
  write: write,
  writeOne: makeWriteOne(write),
  makeWriteOne: makeWriteOne,
  resolveIndexDocs: resolveIndexDocs,
  addIndexDocs: addIndexDocs,
  makeIndexDocs: makeIndexDocs,
  makeIndexDoc: makeIndexDoc,
  makeRange: makeRange
}

// settings = {
//   db: JS,
//   indexes: JSON,
//   level_opts: JSON
// }

function esc (value) {
  // Don't stringify null false etc
  if (value) {
    return stringify(value).replace('ÿ', '&&xff')
  }
}


function read (settings, query) {
  if(!tc('{ createIfMissing: Boolean, ... }', settings.db.options)) {
    throw new Error('settings.db is not supposed to be ' + settings.db)
  }

  var range = makeRange(query, settings.level_opts)
  var deferred = pull.defer()

  if (query.peek) {
    peek[query.peek](settings.db, range, function (err, key, value) {
      deferred.resolve(
        pull(
          pull.values([{ key: key, value: value }]),
          resolveIndexDocs(settings.db)
        )
      )
    })
  } else {
    deferred.resolve(
      pull(
        pl.read(settings.db, range),
        resolveIndexDocs(settings.db)
      )
    )
  }

  return deferred
}

function makeReadOne (read) {
  return function readOne (settings, query, callback) {
    pull(
      read(settings, query),
      pull.collect(function (err, arr) {
        callback(err, arr[0])
      })
    )
  }
}

function write (settings, callback) {
  if(!tc('{ createIfMissing: Boolean, ... }', settings.db.options)) {
    throw new Error('settings.db is not supposed to be ' + settings.db)
  }

  return pull(
    addIndexDocs(settings.indexes),
    pl.write(settings.db, settings.level_opts, callback)
  )
}

function makeWriteOne (write) {
  return function writeOne (settings, doc, callback) {
    pull(
      pull.values([doc]),
      write(settings, callback)
    )
  }
}


function resolveIndexDocs (db) {
  return pull.asyncMap(function (data, callback) {
    db.get(data.value, function (err, value) {
      callback(null, value && { key: data.value, value: value })
    })
  })
}

function addIndexDocs (indexes) {
  return pull(
    pull.map(function (doc) {
      var batch = makeIndexDocs({ key: doc.key, value: doc.value }, indexes)
      doc.type = 'put'
      batch.push(doc)
      return batch
    }),
    pull.flatten()
  )
}

function makeIndexDocs (doc, indexes) {
  if (!tc('[String|[String]]', indexes)) {
    throw new Error('indexes is not supposed to be ' + indexes)
  }

  var batch = []

  // Generate an index doc for each index
  Object.keys(indexes).forEach(function (key) {
    batch.push(makeIndexDoc(doc, indexes[key]))
  })

  return batch
}


function makeIndexDoc (doc, index) {
  if (!Array.isArray(index)) { index = [ index ] }

  function reduceKey (acc, keypath) {
    var  index_prop = esc(access(doc.value, keypath))
    acc.push(index_prop)
    return acc
  }

  var val = reduce(index, reduceKey, [])

  var index_doc = {
    key: 'ÿiÿ' + index.join(',') + 'ÿ' + val.join('ÿ') + 'ÿ' + doc.key + 'ÿ',
    value: doc.key,
    type: 'put'
  }

  return index_doc
}


function makeRange (query, level_opts) {
  // Avoid having to write queries with redundant array notation
  if (!Array.isArray(query.k)) { query.k = [ query.k ] }
  if (!Array.isArray(query.v)) { query.v = [ query.v ] }

  // Gathers values in query value field, generating gte - lte
  function reduceV (acc, item) {
    // Avoid having to write queries with redundant array notation
    if (!Array.isArray(item)) { item = [ item ] }
    // Push bottom of range (first array element) into gte
    acc.gte.push(esc(item[0]))
    // If it is not a range, use same value for lte, if it is use top of range
    acc.lte.push(esc(item.length > 1 ? item[1] : item[0]))

    return acc
  }

  var acc = reduce(query.v, reduceV, { gte: [], lte: [] })

  // Eliminate null values
  var lte = compact(acc.lte)
  var gte = compact(acc.gte)

  var range = {
    // ÿiÿ identifies an index doc
    // esc(query.k.join(',')) makes an identifier for the index
    // gte/lte.join('ÿ') joins the ranges with the delimiter
    gte: 'ÿiÿ' + query.k.join(',') + 'ÿ' + gte.join('ÿ') + 'ÿ',
    lte: 'ÿiÿ' + query.k.join(',') + 'ÿ' + lte.join('ÿ') + 'ÿÿ'
  }

  if (query.reverse) { range.reverse = true }

  range = merge(level_opts || {}, range)

  return range
}
