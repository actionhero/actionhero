var ActionheroPrototype = require('actionhero')
var actionhero = new ActionheroPrototype()
var expect = require('chai').expect
var api

describe('actionhero Tests', () => {
  before((done) => {
    actionhero.start((error, a) => {
      expect(error).to.be.null
      api = a
      done()
    })
  })

  after((done) => {
    actionhero.stop(function (error) {
      expect(error).to.be.null
      done()
    })
  })

  it('should have booted into the test env', () => {
    process.env.NODE_ENV.should.equal('test')
    expect(api.env).to.equal('test')
    expect(api.id).to.be.ok
  })

  it('can retrieve server uptime via the status action', (done) => {
    api.specHelper.runAction('status', (response) => {
      expect(response.error).to.be.null
      expect(response.uptime).toBeGreaterThan(0)
      done()
    })
  })
})
