'use strict';

var access = require('safe-access')
var pull = require('pull-stream')
var pl = require('pull-level')
var merge = require('lodash/object/merge')
var compact = require('lodash/array/compact')
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
  makeIndexDoc: makeIndexDoc,
  makeRange: makeRange
}

// settings = {
//   db: JS,
//   index_defs: JSON,
//   level_opts: JSON
// }

function esc (value) {
  // Don't stringify null false etc
  // if (value) {
    return stringify(value).replace('ÿ', '&&xff')
  // }
}

// Returns a source stream containing all the documents selected by a query
function read (settings, query) {
  if(!tc('{ createIfMissing: Boolean, ... }', settings.db.options)) {
    throw new Error('settings.db is not supposed to be ' + settings.db)
  }

  // Make a range from the query
  var range = makeRange(query, settings.level_opts)
  var deferred = pull.defer()

  if (query.peek) {
    // Use level-peek to get first or last
    peek[query.peek](settings.db, range, function (err, key, value) {
      if (err) { throw err }
      deferred.resolve(
        pull(
          // If document exists, put into stream, if not, send empty stream
          key ? pull.values([{ key: key, value: value }]) : pull.empty(),
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

// Takes a function returning a source stream and returns a function readOne
// which reads one item from a stream and returns it with a callback syntax.
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

// Returns a sink stream writing the documents passed in as well as their
// corresponding index_defs.
function write (settings, callback) {
  if(!tc('{ createIfMissing: Boolean, ... }', settings.db.options)) {
    throw new Error('settings.db is not supposed to be ' + settings.db)
  }

  return pull(
    addIndexDocs(settings.index_defs),
    pl.write(settings.db, settings.level_opts, callback)
  )
}

// Takes a function returning a sink stream and returns a function writeOne
// which takes a document and writes it to the stream
function makeWriteOne (write) {
  return function writeOne (settings, doc, callback) {
    pull(
      pull.values([doc]),
      write(settings, callback)
    )
  }
}

// Returns a through stream which takes index documents and resolves them to
// actual documents
function resolveIndexDocs (db) {
  return pull.asyncMap(function (data, callback) {
    db.get(data.value, function (err, value) {
      callback(null, value && { key: data.value, value: value })
    })
  })
}

// Returns a through stream which injects index docs corresponding to each doc
// in the input stream
function addIndexDocs (index_defs) {
  if (!tc('[String|[String]]', index_defs)) {
    throw new Error('index_defs is not supposed to be ' + index_defs)
  }

  return pull(
    pull.map(function (doc) {
      var batch = Object.keys(index_defs).map(function (key) {
        return makeIndexDoc(doc, index_defs[key])
      })

      doc.type = 'put'
      batch.push(doc)
      return batch
    }),
    pull.flatten()
  )
}

// Returns an index document generated from doc and index_def
function makeIndexDoc (doc, index_def) {
  if (!Array.isArray(index_def)) { index_def = [ index_def ] }

  // Assemble index key from index definition
  var index_key = index_def.reduce(function (acc, keypath) {
    var index_prop = esc(access(doc.value, keypath))
    acc.push(index_prop)
    return acc
  }, [])

  var index_doc = {
    // ÿiÿ identifies an index doc
    // esc(query.k.join(',')) makes an identifier for the index
    // index_key.join('ÿ') joins the index key with the delimiter
    // doc.key is added to ensure uniqueness
    key: 'ÿiÿ' + index_def.join(',') + 'ÿ' + index_key.join('ÿ') + 'ÿ' + doc.key + 'ÿ',
    value: doc.key,
    type: 'put'
  }

  return index_doc
}

// Generate a range that retreives the documents requested by the query
function makeRange (query, level_opts) {
  // Avoid having to write queries with redundant array notation
  if (!Array.isArray(query.k)) { query.k = [ query.k ] }
  if (!Array.isArray(query.v)) { query.v = [ query.v ] }

  // Gathers values in query value field, generating gte - lte
  var acc = query.v.reduce(function (acc, item) {
    // Avoid having to write queries with redundant array notation
    if (!Array.isArray(item)) { item = [ item ] }
    // Push bottom of range (first array element) into gte
    acc.gte.push(esc(item[0]))
    // If it is not a range, use same value for lte, if it is use top of range
    acc.lte.push(esc(item.length > 1 ? item[1] : item[0]))

    return acc
  }, { gte: [], lte: [] })

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
