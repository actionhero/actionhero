'use strict'

let path = require('path')
var expect = require('chai').expect
var ActionheroPrototype = require(path.resolve(__dirname, '..', '..', 'actionhero.js'))
var actionhero = new ActionheroPrototype()
var multiAction = require('./multiAction.js.helper')
var uuid = require('uuid')
var api

describe('Benchmarks', () => {
  before((done) => {
    actionhero.start((error, a) => {
      expect(error).to.be.null
      api = a
      done()
    })
  })

  after((done) => {
    actionhero.stop(done)
  })

  it('cacheTest', (done) => {
    multiAction(api, 'cacheTest', 1000, {
      key: () => { return uuid.v4() },
      value: () => { return uuid.v4() }
    }, (durationSeconds, response) => {
      // console.log(response)
      done()
    })
  }).timeout(20000)
})
