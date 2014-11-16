'use strict';

var test = require('tape')
var level = require('level')

var db = level('./test.db')

var indexes = [
  'timestamp',
  'content.id',
  [ 'content.id', 'timestamp' ]
]

var llibrarian = require('../index.js')(db, indexes)

// ## llibrarian.put(key, value[, options][, callback])
// `key`: same as levelup
// `value`: same as levelup
// `options`: same as levelup, with the addition of 2 new options:
//   * `db`: this is the leveldb to use, this will override the db set
//     at initialization
//   * `indexes`: this is an array of indexes to create, this will override
//     the indexes set at initialization

var message = {
  key: 'w32fwfw33',
  value: {
    timestamp: '29304857',
    content: { id: 's1df34sa3df', flip: 'flop' }
  }
}

llibrarian.put('xyz', message, function (err) {
 debugger
})