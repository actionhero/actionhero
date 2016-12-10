'use strict'

var should = require('should')
let path = require('path')
var ActionheroPrototype = require(path.join(__dirname, '/../../actionhero.js'))
var actionhero = new ActionheroPrototype()
var api

describe('Core: Errors', function () {
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

  it('returns string errors properly', (done) => {
    api.specHelper.runAction('notARealAction', {}, (response) => {
      response.error.should.equal('Error: unknown action or invalid apiVersion')
      done()
    })
  })

  it('returns Error object properly', (done) => {
    api.config.errors.unknownAction = function () {
      return new Error('error test')
    }
    api.specHelper.runAction('notARealAction', {}, (response) => {
      response.error.should.equal('Error: error test')
      done()
    })
  })

  it('returns generic object properly', (done) => {
    api.config.errors.unknownAction = function () {
      return {code: 'error111'}
    }
    api.specHelper.runAction('notARealAction', {}, (response) => {
      response.error.should.have.property('code').equal('error111')
      done()
    })
  })
})
