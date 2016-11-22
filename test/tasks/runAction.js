'use strict'

var should = require('should')
var path = require('path')
var ActionheroPrototype = require(path.join(__dirname, '/../../actionhero.js'))
var actionhero = new ActionheroPrototype()
var api

describe('Test: RunAction', function () {
  before(function (done) {
    actionhero.start(function (error, a) {
      should.not.exist(error)
      api = a
      done()
    })
  })

  after(function (done) {
    actionhero.stop(function () {
      done()
    })
  })

  it('can run the task manually', function (done) {
    api.specHelper.runTask('runAction', {action: 'randomNumber'}, function (error, response) {
      should.not.exist(error)
      response.randomNumber.should.be.greaterThan(0)
      response.randomNumber.should.be.lessThan(1)
      done()
    })
  })
})
