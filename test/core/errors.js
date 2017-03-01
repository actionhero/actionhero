'use strict'

var chai = require('chai')
var dirtyChai = require('dirty-chai')
var expect = chai.expect
chai.use(dirtyChai)

let path = require('path')
var ActionheroPrototype = require(path.join(__dirname, '/../../actionhero.js'))
var actionhero = new ActionheroPrototype()
var api

describe('Core: Errors', () => {
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

  it('returns string errors properly', (done) => {
    api.specHelper.runAction('notARealAction', {}, (response) => {
      expect(response.error).to.equal('Error: unknown action or invalid apiVersion')
      done()
    })
  })

  it('returns Error object properly', (done) => {
    api.config.errors.unknownAction = () => {
      return new Error('error test')
    }
    api.specHelper.runAction('notARealAction', {}, (response) => {
      expect(response.error).to.equal('Error: error test')
      done()
    })
  })

  it('returns generic object properly', (done) => {
    api.config.errors.unknownAction = () => {
      return {code: 'error111', reason: 'busted'}
    }
    api.specHelper.runAction('notARealAction', {}, (response) => {
      expect(response.error.code).to.equal('error111')
      expect(response.error.reason).to.equal('busted')
      done()
    })
  })
})
