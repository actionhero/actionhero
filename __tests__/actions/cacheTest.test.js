'use strict'

let path = require('path')
var ActionheroPrototype = require(path.join(__dirname, '/../../actionhero.js'))
var actionhero = new ActionheroPrototype()
var api

describe('Action: Cache', () => {
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

  it('no params', (done) => {
    api.specHelper.runAction('cacheTest', {}, (response) => {
      expect(response.error).toBe('Error: key is a required parameter for this action')
      done()
    })
  })

  it('just key', (done) => {
    api.specHelper.runAction('cacheTest', {key: 'test key'}, (response) => {
      expect(response.error).toBe('Error: value is a required parameter for this action')
      done()
    })
  })

  it('just value', (done) => {
    api.specHelper.runAction('cacheTest', {value: 'abc123'}, (response) => {
      expect(response.error).toBe('Error: key is a required parameter for this action')
      done()
    })
  })

  it('gibberish param', (done) => {
    api.specHelper.runAction('cacheTest', {thingy: 'abc123'}, (response) => {
      expect(response.error).toBe('Error: key is a required parameter for this action')
      done()
    })
  })

  it('requires value to be longer than 2 letters', (done) => {
    api.specHelper.runAction('cacheTest', {key: 'abc123', value: 'v'}, (response) => {
      expect(response.error).toBe('Error: `value` should be at least 3 letters long')
      done()
    })
  })

  it('correct params', (done) => {
    api.specHelper.runAction('cacheTest', {key: 'testKey', value: 'abc123'}, (response) => {
      expect(response.cacheTestResults.saveResp).toBe(true)
      expect(response.cacheTestResults.loadResp.value).toBe('abc123')
      expect(response.cacheTestResults.deleteResp).toBe(true)
      done()
    })
  })
})
