'use strict'

let path = require('path')
var ActionheroPrototype = require(path.join(__dirname, '/../../actionhero.js'))
var actionhero = new ActionheroPrototype()
var api

describe('Action: RandomNumber', () => {
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

  var firstNumber = null
  it('generates random numbers', (done) => {
    api.specHelper.runAction('randomNumber', (response) => {
      expect(response.randomNumber).toBeGreaterThanOrEqual(0)
      expect(response.randomNumber).toBeLessThanOrEqual(1)
      firstNumber = response.randomNumber
      done()
    })
  })

  it('is unique / random', (done) => {
    api.specHelper.runAction('randomNumber', (response) => {
      expect(response.randomNumber).toBeGreaterThanOrEqual(0)
      expect(response.randomNumber).toBeLessThanOrEqual(1)
      expect(response.randomNumber).not.toBe(firstNumber)
      done()
    })
  })
})
