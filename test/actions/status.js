'use strict'

var should = require('should')
let path = require('path')
var ActionheroPrototype = require(path.join(__dirname, '/../../actionhero.js'))
var actionhero = new ActionheroPrototype()
var api

describe('Action: status', function () {
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

  it('returns node status', function (done) {
    api.specHelper.runAction('status', function (response) {
      // response.nodeStatus.should.equal('Node Healthy');
      response.problems.length.should.equal(0)
      response.id.should.equal('test-server')
      done()
    })
  })
})
