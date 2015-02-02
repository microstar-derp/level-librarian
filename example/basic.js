var llibrarian = require('level-librarian')
var pull = require('pull-stream')

var level = require('level')
var db = level('./test.db', { valueEncoding: 'json' })

var messages = [
  {
    key: 'OJLwdb',
    value: {
      timestamp: 1422732779407,
      content: { score: 4, name: 'adam' }
    }
  },
  {
    key: '36gbso',
    value: {
      timestamp: 1422732795438,
      content: { score: 4, name: 'richard' }
    }
  },
  {
    key: 'zm35bT',
    value: {
      timestamp: 1422732852573,
      content: { score: 5, name: 'ann' }
    }
  },
  {
    key: '5ZJNrc',
    value: {
      timestamp: 1422732866728,
      content: { score: 5, name: 'bob' }
    }
  },
  {
    key: 'QC3v9i',
    value: {
      timestamp: 1422732902893,
      content: { score: 5, name: 'mary' }
    }
  },
  {
    key: 'IB5y8S',
    value: {
      timestamp: 1422732928131,
      content: { score: 5, name: 'zed' }
    }
  },
  {
    key: 'y8SFCi',
    value: {
      timestamp: 1422732928886,
      content: { score: 6, name: 'heinrich' }
    }
  },
  {
    key: 'fDyceD',
    value: {
      timestamp: 1422732961057,
      content: { score: 7, name: 'josh' }
    }
  }
]

var settings = {
  db: db,
  index_defs: [
    ['content.score', 'content.name'],
    'timestamp'
  ]
}

pull(
  pull.values(messages),
  llibrarian.write(settings, function () {
    console.log('done!')

    pull(
      llibrarian.read(settings, { k: ['content.score', 'content.name'], v: [5, ['b', 'y']] }),
      pull.collect(function (err, arr) {
        console.log('\n\n\nquery: { k: ["content.score", "content.name"], v: [5, ["b", "y"]] }', arr)
      })
    )

    pull(
      llibrarian.read(settings, { k: ['content.score', 'content.name'], v: 4 }),
      pull.collect(function (err, arr) {
        console.log('\n\n\nquery: { k: ["content.score", "content.name"], v: 4 }', arr)
      })
    )

    pull(
      llibrarian.read(settings, { k: 'timestamp', v: [1422732800000, 1422732900000] }),
      pull.collect(function (err, arr) {
        console.log('\n\n\nquery: { k: "timestamp", v: [1422732800000, 1422732900000] }', arr)
      })
    )
  })
)