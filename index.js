'use strict';

var access = require('safe-access')
var pull = require('pull-stream')
var pl = require('pull-level')
var r = require('ramda')
var peek = require('level-peek')
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

function esc (string) {
  if (string) { return String(string).replace('ÿ', '&&xff') }
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
  }
  else {
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
  var maybeKey = doc.key;
  var val = []

  index.forEach(function (keypath) {
    if (keypath === '$latest') {
      maybeKey = ''
    } else {
      val.push(esc(access(doc.value, keypath) + ''))
    }
  })

  return {
    key: 'ÿiÿ' + index.join(',') + 'ÿ' + val.join('ÿ') + 'ÿ' + maybeKey + 'ÿ',
    value: doc.key,
    type: 'put'
  }
}


function makeRange (query, level_opts) {
  if (!Array.isArray(query.k)) { query.k = [ query.k ] }
  if (!Array.isArray(query.v)) { query.v = [ query.v ] }

  function reduceV (acc, item) {
    if (!Array.isArray(item)) { item = [ item ] }
    acc.gte.push(esc(item[0]))
    acc.lte.push(esc(item.length > 1 ? item[1] : item[0]))

    return acc
  }

  var acc = r.reduce(reduceV, { gte: [], lte: [] }, query.v)

  var compact = r.filter(r.identity)
  var lte = compact(acc.lte)
  var gte = compact(acc.gte)

  var range = {
    gte: 'ÿiÿ' + esc(query.k.join(',')) + 'ÿ' + gte.join('ÿ') + 'ÿ',
    lte: 'ÿiÿ' + esc(query.k.join(',')) + 'ÿ' + lte.join('ÿ') + 'ÿÿ'
  }

  return r.mixin(level_opts || {}, range)
}
