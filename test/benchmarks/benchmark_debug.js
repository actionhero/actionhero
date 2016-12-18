'use strict'

let path = require('path')
var expect = require('chai').expect
var ActionheroPrototype = require(path.resolve(__dirname, '..', '..', 'actionhero.js'))
var actionhero = new ActionheroPrototype()
var multiAction = require('./multiAction.js.helper')
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

  it('debug', (done) => {
    multiAction(api, 'debug', 1000, {}, (durationSeconds, response) => {
      // console.log(response)
      done()
    })
  }).timeout(20000)
})
