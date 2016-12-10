'use strict'

let path = require('path')
let should = require('should')
var ActionheroPrototype = require(path.resolve(__dirname, '..', '..', 'actionhero.js'))
var actionhero = new ActionheroPrototype()
var uuid = require('uuid')
var api
var messages = []

var multiAction = function (action, count, params, next) {
  var inFlight = 0
  var i = 0
  var start = new Date().getTime()
  while (i < count) {
    inFlight++
    var theseParams = {}
    for (var x in params) {
      theseParams[x] = params[x]
      if (typeof theseParams[x] === 'function') {
        theseParams[x] = theseParams[x]()
      }
    }
    api.specHelper.runAction(action, theseParams, () => {
      inFlight--
      if (inFlight === 0) {
        var durationSeconds = ((new Date().getTime()) - start) / 1000
        messages.push('benchmark: action: ' + action + ' x ' + count + ' >>> ' + durationSeconds + 's')
        next(durationSeconds)
      }
    })
    i++
  }
}

describe('Benchmarks', () => {
  beforeAll((done) => {
    actionhero.start((error, a) => {
      expect(error).toBeNull()
      api = a
      done()
    })
  })

  afterAll((done) => {
    this.timeout(10 * 1000)

    actionhero.stop(() => {
      console.log('')
      console.log('')
      messages.forEach(function (message) {
        console.log(message)
      })

      // let the load-avg cool off
      setTimeout(done, 5001)
    })
  })

  it('randomNumber', (done) => {
    this.timeout(20 * 1000)
    multiAction('randomNumber', 1000, {}, () => {
      done()
    })
  })

  it('status', (done) => {
    this.timeout(45 * 1000)
    multiAction('status', 100, {}, () => {
      done()
    })
  })

  it('cacheTest', (done) => {
    this.timeout(20 * 1000)
    multiAction('cacheTest', 1000, {
      key: () => { return uuid.v4() },
      value: () => { return uuid.v4() }
    }, () => {
      done()
    })
  })

  it('sleepTest', (done) => {
    this.timeout(20 * 1000)
    multiAction('sleepTest', 1000, {}, () => {
      done()
    })
  })

  it('debug', (done) => {
    this.timeout(20 * 1000)
    multiAction('debug', 1000, {}, () => {
      done()
    })
  })
})
