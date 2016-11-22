'use strict'

var should = require('should')
let path = require('path')
var ActionheroPrototype = require(path.join(__dirname, '/../../actionhero.js'))
var actionhero = new ActionheroPrototype()
var api

describe('Action: Show Documentation', function () {
  before(function (done) {
    actionhero.start(function (error, a) {
      should.not.exist(error)
      api = a
      done()
    })
  })

  after(function (done) {
    actionhero.stop(function () {
      done()
    })
  })

  it('returns the correct parts', function (done) {
    api.specHelper.runAction('showDocumentation', function (response) {
      Object.keys(response.documentation).length.should.equal(6) // 6 actions
      response.serverInformation.serverName.should.equal('actionhero')
      done()
    })
  })
})
