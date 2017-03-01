'use strict'

var chai = require('chai')
var dirtyChai = require('dirty-chai')
var expect = chai.expect
chai.use(dirtyChai)

let path = require('path')
var ActionheroPrototype = require(path.resolve(__dirname, '..', '..', 'actionhero.js'))
var actionhero = new ActionheroPrototype()
var multiAction = require('./multiAction.js.helper')
var api

describe('Benchmarks', () => {
  before((done) => {
    actionhero.start((error, a) => {
      expect(error).to.be.null()
      api = a
      done()
    })
  })

  after((done) => {
    actionhero.stop(done)
  })

  it('status', (done) => {
    multiAction(api, 'status', 100, {}, (durationSeconds, response) => {
      // console.log(response)
      done()
    })
  }).timeout(45000)
})
