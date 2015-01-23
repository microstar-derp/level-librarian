// TODO
// test with duplicate indexes
// test with indexes as object

'use strict';

var test = require('tape')
var level = require('level-test')()
var llibrarian = require('../index.js')
var pull = require('pull-stream')
var pl = require('pull-level')

var db = level('./test1.db', { valueEncoding: 'json' })

var indexes = [
  'content.score',
  ['content.score', 'timestamp'],
  ['content.score', '$latest'],
]

var settings = {
  indexes: indexes,
  db: db
}


test('\n\n.write(settings)', function (t) {
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
  }]

  pull(
    pull.values(docs),
    llibrarian.write(settings, function (err) {
      t.error(err)
      checkDB()
    })
  )

  function checkDB () {
    pull(
      pl.read(db),
      pull.collect(function (err, arr) {
        t.error(err)
        t.deepEqual(arr, dbContents)
        t.end()
      })
    )
  }

  var dbContents = [{
    key: '39djdjj31',
    value: {
      content: {
        name: 'mary',
        score: 5
      },
      timestamp: '29304932'
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
    key: 'ÿiÿcontent.score,$latestÿ4ÿÿ',
    value: 'dlnqoq003'
  }, {
    key: 'ÿiÿcontent.score,$latestÿ5ÿÿ',
    value: '39djdjj31'
  }, {
    key: 'ÿiÿcontent.score,timestampÿ4ÿ29304857ÿw32fwfw33ÿ',
    value: 'w32fwfw33'
  }, {
    key: 'ÿiÿcontent.score,timestampÿ4ÿ29304990ÿdlnqoq003ÿ',
    value: 'dlnqoq003'
  }, {
    key: 'ÿiÿcontent.score,timestampÿ5ÿ29304932ÿ39djdjj31ÿ',
    value: '39djdjj31'
  }, {
    key: 'ÿiÿcontent.scoreÿ4ÿdlnqoq003ÿ',
    value: 'dlnqoq003'
  }, {
    key: 'ÿiÿcontent.scoreÿ4ÿw32fwfw33ÿ',
    value: 'w32fwfw33'
  }, {
    key: 'ÿiÿcontent.scoreÿ5ÿ39djdjj31ÿ',
    value: '39djdjj31'
  }]
})

test('\n\n.read(settings, query)', function (t) {
  t.plan(13)

  // This should retrieve all documents with a score of 4
  var queryA = {
    k: ['content.score'],
    v: '4'
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
      console.log('A', JSON.stringify(arr))
      t.deepEqual(arr, resultA, 'A')
    })
  )

  // Reduce reptition of test code
  function check (query, result, string) {
    pull(
      llibrarian.read(settings, query),
      pull.collect(function(err, arr) {
        t.error(err)
        console.log(string, JSON.stringify(arr))
        t.deepEqual(arr, result, string)
      })
    )
  }

  // This should retrieve the latest documents with a score of 4 or 5
  var queryB = {
    k: ['content.score', '$latest'],
    v: [['4', '5']] // content.score value range
  }

  var resultB = [{
    key: 'dlnqoq003',
    value: {'timestamp':'29304990','content':{'name':'jeff','score':4}}
  }, {
    key: '39djdjj31',
    value: {'timestamp':'29304932','content':{'name':'mary','score':5}}
  }]

  check(queryB, resultB, 'B')

  // This should retrieve all documents with a content.score of 4 with a
  // timestamp between '29304857' and '29304923'
  var queryC = {
    k: ['content.score', 'timestamp'],
    v: ['4', ['29304857', '29304923']] // timestamp value range
  }

  var resultC = [{
    key: 'w32fwfw33',
    value: {'timestamp':'29304857','content':{'name':'richard','score':4}}
  }]

  check(queryC, resultC, 'C')


  // This should retrieve all documents with a score of 4 (just like the first
  // example, since we left the timestamp off)
  var queryD = {
    k: ['content.score', 'timestamp'],
    v: '4', // Timestamp value left off
  }

  var resultD = [{
    key: 'w32fwfw33',
    value: {'timestamp':'29304857','content':{'name':'richard','score':4}}
  }, {
    key: 'dlnqoq003',
    value: {'timestamp':'29304990','content':{'name':'jeff','score':4}}
  }]

  check(queryD, resultD, 'D')


  // This should retrieve all documents with a score of 4 and a timestamp >
  // 29304950
  var queryE = {
    k: ['content.score', 'timestamp'],
    v: ['4', ['29304950', null]]
  }

  var resultE = [{
    key: 'dlnqoq003',
    value: {'timestamp':'29304990','content':{'name':'jeff','score':4}}
  }]

  check(queryE, resultE, 'E')


  // This should retrieve all documents with a score of 4 and a timestamp <
  // 29304950
  var queryF = {
    k: ['content.score', 'timestamp'],
    v: ['4', [null, '29304950']]
  }

  var resultF = [{
    key: 'w32fwfw33',
    value: {'timestamp':'29304857','content':{'name':'richard','score':4}}
  }]

  check(queryF, resultF, 'F')

  // This should retrieve the last document with a score of 4, ordered by
  // timestamp
  var queryG = {
    k: ['content.score', 'timestamp'],
    v: '4', // Timestamp value left off
    peek: 'last'
  }

  var resultG = [{
    key: 'dlnqoq003',
    value: {'timestamp':'29304990','content':{'name':'jeff','score':4}}
  }]

  check(queryG, resultG, 'G')
})


test('\n\n.readOne(settings, query, callback)', function (t) {
  function check (query, result, string) {
    llibrarian.readOne(settings, query, function (err, item) {
      t.error(err)
      console.log(string, JSON.stringify(item))
      t.deepEqual(item, result, string)
      t.end()
    })
  }

  // This should retrieve the latest documents with a score of 4 or 5
  var queryA = {
    k: ['content.score', '$latest'],
    v: [['4', '5']] // content.score value range
  }

  var resultA = {
    key: 'dlnqoq003',
    value: {'timestamp':'29304990','content':{'name':'jeff','score':4}}
  }

  check(queryA, resultA, 'A')
})


test('\n\n.addIndexDocs(indexes)', function (t) {
  var doc = {
    key: 'w32fwfw33',
    value: {
      timestamp: '29304857',
      content: {
        name: 'richard',
        score: 4
      }
    }
  }

  var expected = [{
    key: 'ÿiÿcontent.scoreÿ4ÿw32fwfw33ÿ',
    type: 'put',
    value: 'w32fwfw33'
  }, {
    key: 'ÿiÿcontent.score,timestampÿ4ÿ29304857ÿw32fwfw33ÿ',
    type: 'put',
    value: 'w32fwfw33'
  }, {
    key: 'ÿiÿcontent.score,$latestÿ4ÿÿ',
    type: 'put',
    value: 'w32fwfw33'
  }, {
    key: 'w32fwfw33',
    type: 'put',
    value: {
      content: {
        name: 'richard',
        score: 4
      },
      timestamp: '29304857'
    }
  }]


  pull(
    pull.values([doc]),
    llibrarian.addIndexDocs(indexes), // <-- Here's how you do it
    pull.collect(function(err, arr) {
      console.log(JSON.stringify(arr))
      t.deepEqual(arr, expected)
      t.end()
    })
  )

})


test('\n\n.resolveIndexDocs(db)', function (t) {
  var docs = [{
    key: 'ÿcontent.scoreÿ4ÿdlnqoq003ÿ',
    value: 'dlnqoq003'
  }, {
    key: 'ÿcontent.scoreÿ4ÿw32fwfw33ÿ',
    value: 'w32fwfw33'
  }, {
    key: 'ÿcontent.scoreÿ5ÿ39djdjj31ÿ',
    value: '39djdjj31'
  }]

  var expected = [{
    key: 'dlnqoq003',
    value: {
      timestamp: '29304990',
      content: {
        name: 'jeff',
        score: 4
      }
    }
  }, {
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
  }]

  pull(
    pull.values(docs),
    llibrarian.resolveIndexDocs(db), // <-- Here's how you do it
    pull.collect(function(err, arr) {
      console.log(JSON.stringify(arr))
      t.deepEqual(arr, expected)
      t.end()
    })
  )
})
