'use strict'

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
    api.specHelper.runTask('runAction', {action: 'randomNumber'}, (error, response) => {
      expect(error).toBeUndefined()
      expect(response.randomNumber).toBeGreaterThanOrEqual(0)
      expect(response.randomNumber).toBeLessThanOrEqual(1)
      done()
    })
  })
})
