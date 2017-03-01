'use strict'

var chai = require('chai')
var dirtyChai = require('dirty-chai')
var expect = chai.expect
chai.use(dirtyChai)

var path = require('path')
var ActionheroPrototype = require(path.join(__dirname, '/../../actionhero.js'))
var actionhero = new ActionheroPrototype()
var api

describe('Test: RunAction', () => {
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

  it('can run the task manually', (done) => {
    api.specHelper.runTask('runAction', {action: 'randomNumber'}, (error, response) => {
      expect(error).to.not.exist()
      expect(response.randomNumber).to.be.at.least(0)
      expect(response.randomNumber).to.be.at.most(1)
      done()
    })
  })
})
