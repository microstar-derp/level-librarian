# level-librarian

This module provides an interface to query a leveldb using a simple query language no more complicated that it needs to be. Basic operation involves writing documents to the db using an array of index definitions to generate index documents. These index definitions consist of an array of keypaths that reference properties in the document. These keypaths are then used to generate index documents which are used to find the document on read.

For example:

```js
Document:
{
  key: 'w32fwfw33',
  value: {
    timestamp: 1422732866728,
    content: {
      name: 'richard',
      score: 4
    }
  }
}

Index Definitions:
[
  ['content.score', 'content.name'],
  'timestamp'
]

Index documents Generated:
4::richard
1422732866728

```
level-librarian scans through the index documents according to a query to find the right document or range of documents. As is usual in levedb, the scan is alphabetical.

```js
{
  k: ['content.score', 'content.name'],
  v: [5, ['b', 'y']]
}

4::adam
4::richard
5::ann
------------
5::bob      | Documents selected
5::mary     |
------------
5::zed
6::heinrich
7::josh


{
  k: ['content.score', 'content.name'],
  v: 4
}

------------
4::adam     | Documents selected
4::richard  |
------------
5::ann
5::bob
5::mary
5::zed
6::heinrich
7::josh

{
  k: 'timestamp',
  v: [1422732800000, 1422732900000]
}

1422732779407
1422732795438
---------------
1422732852573  | Documents selected
1422732866728  |
---------------
1422732902893
1422732928131
1422732928886
1422732961057
```

## Glossary

### `settings` object

The first argument of most of the level-librarian methods is a `settings` object. This object should contain:

- `db`: A leveldb instance
- `index_defs`: An array of index definitions
- `level_opts` (optional): Options to pass through to leveldb.

### `document` object

A `document` is an object with a `key` and a `value` property. The value will be stored in leveldb under the key.

```js
{
  key: 'w32fwfw33',
  value: {
    timestamp: 1422732866728,
    content: {
      name: 'richard',
      score: 4
    }
  }
}
```

## API

### .write(settings, callback)

Arguments:

- `settings`: Settings object.
- `callback`: Called when done.

This method returns a pull-stream sink that accepts a stream of documents and writes them to the db, also saving index documents based on the `index_defs` passed in the settings object.

```js
pull(
  pull.values(messages),
  llibrarian.write(settings, function () {
    console.log('done!')
  })
)
```

### .read(settings, query)

Arguments:

- `settings`: Settings object.
- `query`: Query object.

This method reads from the leveldb based on the query passed. It returns a pull-stream source outputting a stream of `documents` that match the query. See above for more on querying.

```js
pull(
  llibrarian.read(settings, { k: ['content.score', 'content.name'], v: [5, ['b', 'y']] }),
  pull.collect(function (err, arr) {
    console.log(arr)
  })
)
```

### .addIndexDocs(index_defs)

Arguments:

- `index_defs`: Array of index definitions.

Returns a through stream which injects index documents corresponding to each document in the input stream.

```js
pull(
  pull.values(messages),
  addIndexDocs(settings.index_defs),
  pull.collect(function (err, arr) {
    console.log(arr)
  })
)
```

### .makeIndexDoc(doc, index_def)

Arguments:

- `doc`: Input document.
- `index_def`: Single index definition.

Returns an index document generated from doc and index_def.

```js
var doc =   {
  key: 'IB5y8S',
  value: {
    timestamp: 1422732928131,
    content: { score: 5, name: 'zed' }
  }
}

var index_def = ['content.score', 'content.name']

var index_doc = makeIndexDoc(doc, index_def)
// TODO
```

### .makeReadOne()

Arguments:

- `read`: Function taking a query and returning a source stream.

This takes a function with the same signature as `.read()`, and returns a function that reads a single item and calls back.

```js
var readOne = makeReadOne(read)

var query = {
  k: ['content.score', 'content.name'],
  v: 4
}

readOne(query, function (err, doc) {
  console.log(JSON.stringify(doc))
})
```

### .makeWriteOne()

Arguments:

- `write`: Function returning a sink stream that writes to the DB.

This takes a function with the same signature as `.write()` and returns a function that writes one object to the db and calls back.

```js
var writeOne = makeWriteOne(write)

var doc = {
  key: 'zm35bT',
  value: {
    timestamp: 1422732852573,
    content: { score: 5, name: 'ann' }
  }
}

writeOne(doc, function (err) {
  console.log('done!')
})
```

### .resolveIndexDocs(db)

Arguments:

- `db`: A leveldb.

