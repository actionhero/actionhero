'use strict'

let path = require('path')
var expect = require('chai').expect
var ActionheroPrototype = require(path.join(__dirname, '/../../actionhero.js'))
var actionhero = new ActionheroPrototype()
var api

describe('Action: status', () => {
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

  it('returns node status', (done) => {
    api.specHelper.runAction('status', (response) => {
      expect(response.problems).to.have.length(0)
      expect(response.id).to.equal('test-server-' + process.pid)
      done()
    })
  })
})
