'use strict'

let path = require('path')
var ActionheroPrototype = require(path.resolve(__dirname, '..', '..', 'actionhero.js'))
var actionhero = new ActionheroPrototype()
var multiAction = require('./multiAction.js.helper')
var uuid = require('uuid')
var api

describe('Benchmarks', () => {
  beforeAll((done) => {
    actionhero.start((error, a) => {
      expect(error).toBeNull()
      api = a
      done()
    })
  })

  afterAll((done) => {
    actionhero.stop(done)
  })

  it('status', (done) => {
    multiAction(api, 'status', 100, {}, (durationSeconds, response) => {
      // console.log(response)
      done()
    })
  }, 45000)
})
