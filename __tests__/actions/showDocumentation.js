'use strict'

let path = require('path')
var ActionheroPrototype = require(path.join(__dirname, '/../../actionhero.js'))
var actionhero = new ActionheroPrototype()
var api

describe('Action: Show Documentation', () => {
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

  it('returns the correct parts', (done) => {
    api.specHelper.runAction('showDocumentation', (response) => {
      expect(Object.keys(response.documentation).length).toBe(6) // 6 actions
      expect(response.serverInformation.serverName).toBe('actionhero')
      done()
    })
  })
})
