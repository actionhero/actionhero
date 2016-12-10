'use strict'

let path = require('path')
var ActionheroPrototype = require(path.join(__dirname, '/../../actionhero.js'))
var actionhero = new ActionheroPrototype()
var api

describe('Action: status', () => {
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

  it('returns node status', (done) => {
    api.specHelper.runAction('status', (response) => {
      expect(response.problems).toHaveLength(0)
      expect(response.id).toBe('test-server')
      done()
    })
  })
})
