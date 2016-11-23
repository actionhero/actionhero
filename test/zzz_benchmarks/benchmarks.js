'use strict'

let path = require('path')
let should = require('should')
var ActionheroPrototype = require(path.resolve(__dirname, '..', '..', 'actionhero.js'))
var actionhero = new ActionheroPrototype()
var uuid = require('node-uuid')
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
    api.specHelper.runAction(action, theseParams, function () {
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

describe('Benchmarks', function () {
  before(function (done) {
    actionhero.start(function (error, a) {
      should.not.exist(error)
      api = a
      done()
    })
  })

  after(function (done) {
    this.timeout(10 * 1000)

    actionhero.stop(function () {
      console.log('')
      console.log('')
      messages.forEach(function (message) {
        console.log(message)
      })

      // let the load-avg cool off
      setTimeout(done, 5001)
    })
  })

  it('randomNumber', function (done) {
    this.timeout(20 * 1000)
    multiAction('randomNumber', 1000, {}, function () {
      done()
    })
  })

  it('status', function (done) {
    this.timeout(45 * 1000)
    multiAction('status', 100, {}, function () {
      done()
    })
  })

  it('cacheTest', function (done) {
    this.timeout(20 * 1000)
    multiAction('cacheTest', 1000, {
      key: function () { return uuid.v4() },
      value: function () { return uuid.v4() }
    }, function () {
      done()
    })
  })

  it('sleepTest', function (done) {
    this.timeout(20 * 1000)
    multiAction('sleepTest', 1000, {}, function () {
      done()
    })
  })

  it('debug', function (done) {
    this.timeout(20 * 1000)
    multiAction('debug', 1000, {}, function () {
      done()
    })
  })
})
