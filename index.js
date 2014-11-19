'use strict';

var access = require('safe-access')
var pull = require('pull-stream')
var pl = require('pull-level')
var _ = require('lodash')

module.exports = {
  read: read,
  write: write,
  mapIndex: mapIndex,
  addIndexDocs: addIndexDocs,
  makeIndexDocs: makeIndexDocs,
  makeIndexDoc: makeIndexDoc,
  makeRange: makeRange
}

// var db = 'level stuff'

// var indexes = [
//   'timestamp', // Property name
//   'content.id', // Keypath
//   [ 'content.id', 'timestamp' ] // Secondary index
// ]

// pull(
//   pull.values(),
//   llibrarian.write(db, indexes)
// )

// pull(
//   llibrarian.read(db, {
//     k: ['content.id', 'timestamp'],
//     v: ['jd03h38h3hi39', ['1234567890', '1234567899']]
//   }),
//   pull.collect(function (arr) {
//     console.log(arr)
//   })
// )

function read (db, query, options) {
  return pull(
    pl.read(db, makeRange(query, options)),
    mapIndex()
  )
}


function write (db, indexes, opts, done) {
  return pull(
    addIndexDocs(indexes),
    pl.write(db, opts, done)
  )
}


function mapIndex (db) {
  return pull.asyncMap(function (data, callback) {
    db.get(data.value, function (value) {
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

  doc.value = JSON.stringify(doc.value)
  doc.type = 'put'
  batch.push(doc)

  return batch
}


function makeIndexDoc (doc, index) {
  if (!Array.isArray(index)) { index = [ index ] }

  var val = index.map(function (index) {
    if (index === '..key') { return doc.key }
    return access(doc.value, index)
  }).join('~')

  return {
      key: '~' + index.join(',') + '~' + val + '~',
      value: doc.key,
      type: 'put'
    }
}


function makeRange (query, options) {
  if (!Array.isArray(query.k)) { query.k = [ query.k ] }
  if (!Array.isArray(query.v)) { query.v = [ query.v ] }

  var gte = []
  var lte = []

  query.v.forEach(function (item) {
    if (!Array.isArray(item)) { item = [ item ] }

    gte.push(item[0])
    lte.push(item[1] || item[0])
  })

  var range = {
    gte: '~' + query.k.join(',') + '~' + gte.join('~') + '~',
    lte: '~' + query.k.join(',') + '~' + lte.join('~') + '~'
  }

  return _.extend(options || {}, range)
}
