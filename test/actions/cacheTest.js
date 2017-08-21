'use strict'

const chai = require('chai')
const dirtyChai = require('dirty-chai')
const expect = chai.expect
chai.use(dirtyChai)

const path = require('path')
const ActionheroPrototype = require(path.join(__dirname, '/../../actionhero.js'))
const actionhero = new ActionheroPrototype()
let api

describe('Action: Cache', () => {
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

  it('no params', (done) => {
    api.specHelper.runAction('cacheTest', {}, (response) => {
      expect(response.error).to.equal('Error: key is a required parameter for this action')
      done()
    })
  })

  it('just key', (done) => {
    api.specHelper.runAction('cacheTest', {key: 'test key'}, (response) => {
      expect(response.error).to.equal('Error: value is a required parameter for this action')
      done()
    })
  })

  it('just value', (done) => {
    api.specHelper.runAction('cacheTest', {value: 'abc123'}, (response) => {
      expect(response.error).to.equal('Error: key is a required parameter for this action')
      done()
    })
  })

  it('gibberish param', (done) => {
    api.specHelper.runAction('cacheTest', {thingy: 'abc123'}, (response) => {
      expect(response.error).to.equal('Error: key is a required parameter for this action')
      done()
    })
  })

  it('requires value to be longer than 2 letters', (done) => {
    api.specHelper.runAction('cacheTest', {key: 'abc123', value: 'v'}, (response) => {
      expect(response.error).to.equal('Error: `value` should be at least 3 letters long')
      done()
    })
  })

  it('correct params', (done) => {
    api.specHelper.runAction('cacheTest', {key: 'testKey', value: 'abc123'}, (response) => {
      expect(response.cacheTestResults.saveResp).to.equal(true)
      expect(response.cacheTestResults.loadResp.value).to.equal('abc123')
      expect(response.cacheTestResults.deleteResp).to.equal(true)
      done()
    })
  })
})
