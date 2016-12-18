'use strict'

let path = require('path')
var expect = require('chai').expect
var ActionheroPrototype = require(path.join(__dirname, '/../../actionhero.js'))
var actionhero = new ActionheroPrototype()
var api

describe('Action: Show Documentation', () => {
  before((done) => {
    actionhero.start((error, a) => {
      expect(error).to.be.null
      api = a
      done()
    })
  })

  after((done) => {
    actionhero.stop(() => {
      done()
    })
  })

  it('returns the correct parts', (done) => {
    api.specHelper.runAction('showDocumentation', (response) => {
      expect(Object.keys(response.documentation).length).to.equal(6) // 6 actions
      expect(response.serverInformation.serverName).to.equal('actionhero')
      done()
    })
  })
})
