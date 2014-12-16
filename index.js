'use strict';

var access = require('safe-access')
var pull = require('pull-stream')
var pl = require('pull-level')
var r = require('ramda')
var peek = require('level-peek')

module.exports = {
  read: read,
  write: write,
  resolveIndexDocs: resolveIndexDocs,
  addIndexDocs: addIndexDocs,
  makeIndexDocs: makeIndexDocs,
  makeIndexDoc: makeIndexDoc,
  makeRange: makeRange
}


function esc (string) {
  if (string) { return string.replace('ÿ', '&&xff') }
  return string
}


function read (db, query, level_opts) {
  var range = makeRange(query, level_opts)
  var deferred = pull.defer()


  if (query.peek) {
    peek[query.peek](db, range, function (err, key, value) {
      deferred.resolve(
        pull(
          pull.values([{ key: key, value: value }]),
          resolveIndexDocs(db)
        )
      )
    })
  }
  else {
    deferred.resolve(
      pull(
        pl.read(db, range),
        resolveIndexDocs(db)
      )
    )
  }

  return deferred
}

function readOne (db, query, level_opts, callback) {
  level_opts.limit = 1
  return pull(
    read(db, query, level_opts),
    pull.collect(function (err, arr) {
      callback(err || null, arr[0])
    })
  )
}

function writeOne (db, indexes, doc, level_opts, callback) {
  return pull(
    pull.values([doc]),
    write(db, indexes, level_opts, callback)
  )
}

function write (db, indexes, level_opts, callback) {
  return pull(
    addIndexDocs(indexes),
    pl.write(db, indexes, level_opts, callback)
  )
}


function resolveIndexDocs (db) {
  return pull.asyncMap(function (data, callback) {
    db.get(data.value, function (err, value) {
      callback(null, { key: data.value, value: value })
    })
  })
}


function addIndexDocs (indexes) {
  return pull(
    pull.map(function (item) {
      return makeIndexDocs({ key: item.key, value: item.value }, indexes)
    }),
    pull.flatten()
  )
}


function makeIndexDocs (doc, indexes) {
  var batch = [];

  // Generate an index doc for each index
  Object.keys(indexes).forEach(function (key) {
    batch.push(makeIndexDoc(doc, indexes[key]))
  })

  doc.type = 'put'
  batch.push(doc)

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
    key: 'ÿ' + index.join(',') + 'ÿ' + val.join('ÿ') + 'ÿ' + maybeKey + 'ÿ',
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
    gte: 'ÿ' + esc(query.k.join(',')) + 'ÿ' + gte.join('ÿ') + 'ÿ',
    lte: 'ÿ' + esc(query.k.join(',')) + 'ÿ' + lte.join('ÿ') + 'ÿÿ'
  }

  return r.mixin(level_opts || {}, range)
}
