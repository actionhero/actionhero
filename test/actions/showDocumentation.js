'use strict'

const chai = require('chai')
const dirtyChai = require('dirty-chai')
const expect = chai.expect
chai.use(dirtyChai)

const path = require('path')
const ActionheroPrototype = require(path.join(__dirname, '/../../actionhero.js'))
const actionhero = new ActionheroPrototype()
let api

describe('Action: Show Documentation', () => {
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

  it('returns the correct parts', (done) => {
    api.specHelper.runAction('showDocumentation', (response) => {
      expect(Object.keys(response.documentation).length).to.equal(6) // 6 actions
      expect(response.serverInformation.serverName).to.equal('actionhero')
      done()
    })
  })
})
