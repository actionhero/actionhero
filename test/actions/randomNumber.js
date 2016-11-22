'use strict'

var should = require('should')
let path = require('path')
var ActionheroPrototype = require(path.join(__dirname, '/../../actionhero.js'))
var actionhero = new ActionheroPrototype()
var api

describe('Action: RandomNumber', function () {
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

  var firstNumber = null
  it('generates random numbers', function (done) {
    api.specHelper.runAction('randomNumber', function (response) {
      response.randomNumber.should.be.a.Number
      response.randomNumber.should.be.within(0, 1)
      firstNumber = response.randomNumber
      done()
    })
  })

  it('is unique / random', function (done) {
    api.specHelper.runAction('randomNumber', function (response) {
      response.randomNumber.should.be.a.Number
      response.randomNumber.should.not.equal(firstNumber)
      done()
    })
  })
})
