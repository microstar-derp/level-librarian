## These docs are incomplete and do not yet make sense

/*
```javascript
/**/

// Why do these docs look weird? They are also the tests.

'use strict';

var test = require('tape')
var cont = require('cont')
var level = require('level')
var llibrarian = require('../index.js')
var pull = require('pull-stream')
var pl = require('pull-level')
var rimraf = require('rimraf')

/*
```
### Initialization
Initialize level-librarian by passing it a leveldb and an array of properties
that you would like to index on. You can also use keypaths, like `'content.id'`.
To create secondary indexes, use an array.

```javascript
/**/

var indexes = [
  'timestamp', // Property name
  'content.id', // Keypath
  [ 'content.id', 'timestamp' ] // Secondary index
]

/*
```
It returns the leveldb, augmented with level-librarian methods.

```javascript
/**/

function dbSetup (indexes) {
  rimraf.sync('./test.db') // Clean up test db from last time

  var db = llibrarian(level('./test.db'), indexes) // Initialize

  return db
}

/*
```
### .putWithIndex(key, value[, options][, callback])

- `key`: same as levelup
- `value`: same as levelup, except it will automatically stringify JSON for you
- `options`: same as levelup, with the addition of 1 new option:
  - `indexes`: this is an array of indexes to create, it will override the indexes set at initialization

```javascript
/**/

test('.putWithIndex(key, value[, options][, callback])', function (t) {
  var value = {
    timestamp: '29304857',
    content: { id: 's1df34sa3df', flip: 'flop' }
  }

  var db = dbSetup(indexes);

  db.putWithIndex('w32fwfw33', value, function (err) {
    if (err) { throw err }
    pull(
      pl.read(db),
      pull.collect(function (err, array) {
        console.log(JSON.stringify(array,null,2))
        t.equal()
      })
    )
    t.end()
  })
})

/*
```
### .readWithIndex(key, value[, options][, callback])
This method returns a pull-stream, exposing the API of pull-level.
- `index`: index definition (same format as supplied in 'indexes' init option)
- `query`: query matching the index definition.
- `options`: same as pull-level, levelup
  - _Note: the `gt`, `gte`, `lt`, and `lte` options will not work, as they are
generated automatically by level-librarian_


```javascript
/**/

test('.readWithIndex(key, value[, options][, callback])', function (t) {
  var value = [{
    timestamp: '29304857',
    content: { id: 's1df34sa3df', flip: 'flop' }
  }]

  var db = dbSetup(indexes)

  db.putWithIndex('w32fwfw33', value, function (err) {})
})

/*
```
/**/
