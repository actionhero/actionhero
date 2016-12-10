'use strict'

var should = require('should')
var path = require('path')
var ActionheroPrototype = require(path.join(__dirname, '/../../actionhero.js'))
var actionhero = new ActionheroPrototype()
var api

describe('Test: RunAction', () => {
  beforeAll((done) => {
    actionhero.start((error, a) => {
      expect(error).toBeNull()
      api = a
      done()
    })
  })

  afterAll((done) => {
    actionhero.stop(() => {
      done()
    })
  })

  it('can run the task manually', (done) => {
    api.specHelper.runTask('runAction', {action: 'randomNumber'}, function (error, response) {
      expect(error).toBeNull()
      response.randomNumber.should.be.greaterThan(0)
      response.randomNumber.should.be.lessThan(1)
      done()
    })
  })
})
