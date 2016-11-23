var request = require('request')
var should = require('should')
var path = require('path')
var ActionheroPrototype = require(path.join(__dirname, '/../../actionhero.js'))
var actionhero = new ActionheroPrototype()
var api

var clientA // eslint-disable-line
var clientB // eslint-disable-line
var clientC // eslint-disable-line

var url

var connectClients = function (callback) {
  // get actionheroClient in scope
  // TODO: Perhaps we read this from disk after server boot.
  eval(api.servers.servers.websocket.compileActionheroClientJS()) // eslint-disable-line

  var S = api.servers.servers.websocket.server.Socket
  var url = 'http://localhost:' + api.config.servers.web.port
  var clientAsocket = new S(url)
  var clientBsocket = new S(url)
  var clientCsocket = new S(url)

  clientA = new ActionheroClient({}, clientAsocket) // eslint-disable-line
  clientB = new ActionheroClient({}, clientBsocket) // eslint-disable-line
  clientC = new ActionheroClient({}, clientCsocket) // eslint-disable-line

  setTimeout(function () {
    callback()
  }, 100)
}

describe('Integration: Web Server + Websocket Socket', function () {
  before(function (done) {
    actionhero.start(function (error, a) {
      should.not.exist(error)
      api = a
      url = 'http://localhost:' + api.config.servers.web.port
      api.config.servers.websocket.clientUrl = 'http://localhost:' + api.config.servers.web.port

      connectClients(function () {
        done()
      })
    })
  })

  after(function (done) {
    actionhero.stop(function () {
      done()
    })
  })

  describe('fingerprint', function () {
    var cookieHeader
    var oldRequest

    beforeEach(function (done) {
      try {
        clientA.disconnect()
      } catch (e) {
      }
      cookieHeader = ''
      connectClients(done)
    })

    before(function (done) {
      // Override http.request to test fingerprint
      var module = require('http')
      oldRequest = module.request
      module.request = function (options, callback) {
        options.headers.Cookie = cookieHeader
        return oldRequest.apply(module, arguments)
      }
      done()
    })

    after(function (done) {
      // Restore http.request
      var module = require('http')
      module.request = oldRequest
      done()
    })

    it('should exist when web server been called', function (done) {
      request.get(url + '/api/', function (error, response, body) {
        should.not.exist(error)
        body = JSON.parse(body)
        var fingerprint = body.requesterInformation.fingerprint
        cookieHeader = response.headers['set-cookie'][0]
        clientA.connect(function (error, response) {
          should.not.exist(error)
          response.status.should.equal('OK')
          should(response.data).have.property('id')
          var id = response.data.id
          api.connections.connections[id].fingerprint.should.equal(fingerprint)
          done()
        })
      })
    })

    it('should not exist when web server has not been called', function (done) {
      clientA.connect(function (error, response) {
        should.not.exist(error)
        response.status.should.equal('OK')
        should(response.data).have.property('id')
        var id = response.data.id
        api.connections.connections[id].should.have.property('fingerprint').which.is['null']
        done()
      })
    })

    it('should exist as long as cookie is passed', function (done) {
      cookieHeader = api.config.servers.web.fingerprintOptions.cookieKey + '=dummyValue'
      clientA.connect(function (error, response) {
        should.not.exist(error)
        response.status.should.equal('OK')
        should(response.data).have.property('id')
        var id = response.data.id
        api.connections.connections[id].should.have.property('fingerprint').which.is.not['null']
        done()
      })
    })
  })
})
