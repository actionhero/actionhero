'use strict'

var chai = require('chai')
var dirtyChai = require('dirty-chai')
var expect = chai.expect
chai.use(dirtyChai)

let path = require('path')
var ActionheroPrototype = require(path.join(__dirname, '/../../actionhero.js'))
var actionhero = new ActionheroPrototype()
var api

describe('Action: RandomNumber', () => {
  before((done) => {
    actionhero.start((error, a) => {
      expect(error).to.be.null()
      api = a
      done()
    })
  })

  after((done) => {
    actionhero.stop(() => {
      done()
    })
  })

  var firstNumber = null
  it('generates random numbers', (done) => {
    api.specHelper.runAction('randomNumber', (response) => {
      expect(response.randomNumber).to.be.at.least(0)
      expect(response.randomNumber).to.be.at.most(1)
      firstNumber = response.randomNumber
      done()
    })
  })

  it('is unique / random', (done) => {
    api.specHelper.runAction('randomNumber', (response) => {
      expect(response.randomNumber).to.be.at.least(0)
      expect(response.randomNumber).to.be.at.most(1)
      expect(response.randomNumber).not.to.equal(firstNumber)
      done()
    })
  })
})
