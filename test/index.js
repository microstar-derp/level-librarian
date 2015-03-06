// TODO
// test with index_defs as object

'use strict';

var test = require('tape')
var llibrarian = require('../index.js')
var pull = require('pull-stream')

var level = require('level-test')()
var db = level('./test1.db', { valueEncoding: 'json' })
var trace = require('get-trace')

function tracify (t) {
  function attach (func) {
    return function () {
      var args = []
      for (var i = 0; i < arguments.length; i++) {
        args.push(arguments[i])
      }
      args.push(trace(2))

      return func.apply(null, args)
    }
  }
  return {
    equal: attach(t.equal),
    deepEqual: attach(t.deepEqual),
    error: attach(t.error),
    end: t.end,
    plan: t.plan
  }
}

var index_defs = [
  'content.score',
  ['content.score', 'timestamp'],
  'content'
]

var settings = {
  index_defs: index_defs,
  db: db
}


test('\n\n.write(settings)', function (t) {
  t = tracify(t)

  var docs = [{
    key: 'w32fwfw33',
    value: {
      timestamp: '29304857',
      content: {
        name: 'richard',
        score: 4
      }
    }
  }, {
    key: '39djdjj31',
    value: {
      timestamp: '29304932',
      content: {
        name: 'mary',
        score: 5
      }
    }
  }, {
    key: 'dlnqoq003',
    value: {
      timestamp: '29304990',
      content: {
        name: 'jeff',
        score: 4
      }
    }
  }, {
    key: 'dfsdfs222',
    value: {
    timestamp: '29305000',
    content: {
      name: 'franklin',
      score: 0
    }
  }}]

  pull(
    pull.values(docs),
    llibrarian.write(settings, function (err) {
      t.error(err)
      t.end()
    })
  )
})

test('\n\n.read(settings, query)', function (t) {
  t = tracify(t)
  t.plan(9)

  // This should retrieve all documents with a score of 4
  var queryA = {
    k: ['content.score'],
    v: 4
  }

  var resultA = [{
    key: 'dlnqoq003',
    value: {'timestamp':'29304990','content':{'name':'jeff','score':4}}
  }, {
    key: 'w32fwfw33',
    value: {'timestamp':'29304857','content':{'name':'richard','score':4}}
  }]

  pull(
    llibrarian.read(settings, queryA),
    pull.collect(function(err, arr) {
      console.log(JSON.stringify(arr))
      t.deepEqual(arr, resultA)
    })
  )

  // Reduce reptition of test code
  function check (query, result, string) {
    pull(
      llibrarian.read(settings, query),
      pull.collect(function(err, arr) {
        if (err) { throw err }
        console.log(JSON.stringify(arr))
        t.deepEqual(arr, result, string)
      })
    )
  }

  // This should retrieve all documents with a score of 4 or 5
  var queryB = {
    k: ['content.score'],
    v: [[4, 5]] // content.score value range
  }

  var resultB = [{
    key: 'dlnqoq003',
    value: {
      content: {
        name: 'jeff',
        score: 4
      },
      timestamp: '29304990'
    }
  }, {
    key: 'w32fwfw33',
    value: {
      content: {
        name: 'richard',
        score: 4
      },
      timestamp: '29304857'
    }
  }, {
    key: '39djdjj31',
    value: {
      content: {
        name: 'mary',
        score: 5
      },
      timestamp: '29304932'
    }
  }]


  check(queryB, resultB, trace(1))

  // This should retrieve all documents with a content.score of 4 with a
  // timestamp between '29304857' and '29304923'
  var queryC = {
    k: ['content.score', 'timestamp'],
    v: [4, ['29304857', '29304923']] // timestamp value range
  }

  var resultC = [{
    key: 'w32fwfw33',
    value: {'timestamp':'29304857','content':{'name':'richard','score':4}}
  }]

  check(queryC, resultC, trace(1))


  // This should retrieve all documents with a score of 4 (just like the first
  // example, since we left the timestamp off)
  var queryD = {
    k: ['content.score', 'timestamp'],
    v: 4, // Timestamp value left off
  }

  var resultD = [{
    key: 'w32fwfw33',
    value: {'timestamp':'29304857','content':{'name':'richard','score':4}}
  }, {
    key: 'dlnqoq003',
    value: {'timestamp':'29304990','content':{'name':'jeff','score':4}}
  }]

  check(queryD, resultD, trace(1))


  // This should retrieve all documents with a score of 4 and a timestamp >
  // '29304950'
  var queryE = {
    k: ['content.score', 'timestamp'],
    v: [4, ['29304950', null]]
  }

  var resultE = [{
    key: 'dlnqoq003',
    value: {'timestamp':'29304990','content':{'name':'jeff','score':4}}
  }]

  check(queryE, resultE, trace(1))


  // This should retrieve all documents with a score of 4 and a timestamp <
  // '29304950'
  var queryF = {
    k: ['content.score', 'timestamp'],
    v: [4, [null, '29304950']]
  }

  var resultF = [{
    key: 'w32fwfw33',
    value: {'timestamp':'29304857','content':{'name':'richard','score':4}}
  }]

  check(queryF, resultF, trace(1))

  // This should retrieve the last document with a score of 4, ordered by
  // timestamp
  var queryG = {
    k: ['content.score', 'timestamp'],
    v: 4, // Timestamp value left off
    peek: 'last'
  }

  var resultG = [{
    key: 'dlnqoq003',
    value: {'timestamp':'29304990','content':{'name':'jeff','score':4}}
  }]

  check(queryG, resultG, trace(1))

  // This should retrieve the document with the corresponding content prop
  var queryH = {
    k: 'content',
    v: { score: 4, name: 'richard' }
  }

  var resultH = [ { key: 'w32fwfw33', value: { content: { name: 'richard', score: 4 }, timestamp: '29304857' } } ]

  check(queryH, resultH, trace(1))

  // This should retrieve all documents with a score of 4 or 5 in reverse
  var queryI = {
    k: ['content.score'],
    v: [[4, 5]], // content.score value range
    reverse: true
  }

  var resultI = [{
    key: '39djdjj31',
    value: {
      content: {
        name: 'mary',
        score: 5
      },
      timestamp: '29304932'
    }
  }, {
    key: 'w32fwfw33',
    value: {
      content: {
        name: 'richard',
        score: 4
      },
      timestamp: '29304857'
    }
  }, {
    key: 'dlnqoq003',
    value: {
      content: {
        name: 'jeff',
        score: 4
      },
      timestamp: '29304990'
    }
  }]

  check(queryI, resultI, trace(1))
})


test('\n\n.readOne(settings, query, callback)', function (t) {
  t = tracify(t)

  function check (query, result, string) {
    llibrarian.readOne(settings, query, function (err, item) {
      t.error(err)
      console.log(string, JSON.stringify(item))
      t.deepEqual(item, result)
      t.end()
    })
  }

  // This should retrieve the first document in the range of scores 4 - 5
  var queryA = {
    k: ['content.score'],
    v: [[4, 5]], // content.score value range
    peek: 'first'
  }

  var resultA = {
    key: 'dlnqoq003',
    value: {'timestamp':'29304990','content':{'name':'jeff','score':4}}
  }

  check(queryA, resultA, 'A')
})
