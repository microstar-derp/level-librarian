# level-librarian

This module provides an interface to query a leveldb using a simple query language- **LLCJ**. Basic operation involves writing documents to the db using an array of index definitions to generate index documents. These index definitions consist of an array of keypaths that reference properties in the document. These keypaths are then used to generate index documents which are used to find the document on read.

## LLCJ Query Language

### Index definitions

Index definitions consist of an array of keypaths referencing properties of the primary document's `value`. These keypaths are used to generate index documents. These index documents have a key containing the values found at the index definition's keypath, and a value containing the key of the primary document. Leveldb can then do an alphabetical scan through the index documents and resolve them to primary documents.

Example index definition:

```js
['content.score', 'content.name']
```

Example primary document:

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

Index document generated:

```js
{
  key: 4::richard, // (greatly simplified)
  value: 'w32fwfw33'
}
```

level-librarian scans through the index documents according to a query to find the right document or range of documents. As is usual in levedb, the scan is alphabetical.

### Queries:

LLCJ queries consist of an object containing a `k` property, a `v` property, and some other optional properties. The `k` property contains the index definition to be used. Indexes must exist in the db before being queried. The `v` property specifies an alphabetical range to return.

Examples:

```js
{
  k: ['content.score', 'content.name'],
  v: [5, 'richard']
}
```
**^** This gets all documents with a `content.score` of `5` and a `content.name` of `'richard'`.

```js
{
  k: ['content.score', 'content.name'],
  v: [5, 'richard']
}
```
**^** This gets all documents with a `content.score` of `5` and a `content.name` of `'bob'`.

```js
{
  k: ['content.score', 'content.name'],
  v: [5, ['b', 'y']]
}
```
**^** This gets all documents with a `content.score` of `5` and a `content.name` between `'b'` and `'y'`.

```js
{
  k: ['content.score', 'content.name'],
  v: 4
}
```
**^** This gets all documents with a `content.score` of `4`. Results are ordered by `content.name`.

```js
{
  k: 'timestamp',
  v: [1422732800000, 1422732900000]
}
```
**^** This gets all documents with a timestamp between `1422732800000` and `1422732900000`.

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

This returns a through stream that takes a stream of index documents and resolves them to the primary documents in the db. This is the guts of `.read()`.

```js
pull(
  pl.read(settings.db, range),
  resolveIndexDocs(settings.db),
  pull.collect(function (err, arr) {
    console.log(arr)
  })
)
```