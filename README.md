/*
```javascript
 */

'use strict';

var test = require('tape')
var level = require('level')
var llibrarian = require('../index.js')
var pull = require('pull-stream')
var pl = require('pull-level')
var rimraf = require('rimraf')

test('create an entry and its indexes', function (t) {

/*
```
### .putWithIndex(key, value[, options][, callback])

- `key`: same as levelup
- `value`: same as levelup, except it will automatically stringify JSON for you
- `options`: same as levelup, with the addition of 1 new option:
  - `indexes`: this is an array of indexes to create, it will override the indexes set at initialization

```javascript
 */

  var indexes = [
    'timestamp',
    'content.id',
    [ 'content.id', 'timestamp' ]
  ]

  var value = {
    timestamp: '29304857',
    content: { id: 's1df34sa3df', flip: 'flop' }
  }

  rimraf.sync('./test.db')
  var db = llibrarian(level('./test.db'), indexes)

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
 */
