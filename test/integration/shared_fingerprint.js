var chai = require('chai')
var dirtyChai = require('dirty-chai')
var _Primus = require('primus')
var expect = chai.expect
chai.use(dirtyChai)

var request = require('request')
var path = require('path')
var ActionheroPrototype = require(path.join(__dirname, '/../../actionhero.js'))
var actionhero = new ActionheroPrototype()
var api

var fingerprint
var url

var connectClient = (transportOptions, callback) => {
  // get actionheroClient in scope
  eval(api.servers.servers.websocket.compileActionheroClientJS()) // eslint-disable-line

  var S = _Primus.createSocket()
  var clientSocket = new S('http://localhost:' + api.config.servers.web.port, {transport: transportOptions})

  var client = new ActionheroClient({}, clientSocket) // eslint-disable-line
  setTimeout(() => {
    callback(null, client)
  }, 100)
}

describe('Integration: Web Server + Websocket Socket shared fingerprint', () => {
  before((done) => {
    actionhero.start((error, a) => {
      expect(error).to.be.null()
      api = a
      url = 'http://localhost:' + api.config.servers.web.port
      api.config.servers.websocket.clientUrl = 'http://localhost:' + api.config.servers.web.port
      done()
    })
  })

  after((done) => {
    actionhero.stop(done)
  })

  it('should exist when web server been called', (done) => {
    request.get(url + '/api/', (error, response, body) => {
      expect(error).to.be.null()
      body = JSON.parse(body)
      fingerprint = body.requesterInformation.fingerprint
      var headers = { cookie: api.config.servers.web.fingerprintOptions.cookieKey + '=' + fingerprint }

      connectClient({headers: headers}, (error, client) => {
        expect(error).to.be.null()
        client.connect((error, response) => {
          expect(error).to.be.null()
          expect(response.status).to.equal('OK')
          expect(response.data.id).to.be.ok()
          var id = response.data.id
          expect(api.connections.connections[id].fingerprint).to.equal(fingerprint)
          client.disconnect()
          done()
        })
      })
    })
  })

  it('should not exist when web server has not been called', (done) => {
    connectClient({}, (error, client) => {
      expect(error).to.be.null()
      client.connect((error, response) => {
        expect(error).to.be.null()
        expect(response.status).to.equal('OK')
        expect(response.data.id).to.be.ok()
        var id = response.data.id
        expect(api.connections.connections[id].fingerprint).not.to.equal(fingerprint)
        client.disconnect()
        done()
      })
    })
  })

  it('should exist as long as cookie is passed', (done) => {
    var headers = { cookie: api.config.servers.web.fingerprintOptions.cookieKey + '=' + 'dummyValue' }
    connectClient({headers: headers}, (error, client) => {
      expect(error).to.be.null()
      client.connect((error, response) => {
        expect(error).to.be.null()
        expect(response.status).to.equal('OK')
        expect(response.data.id).to.be.ok()
        var id = response.data.id
        expect(api.connections.connections[id].fingerprint).to.equal('dummyValue')
        client.disconnect()
        done()
      })
    })
  })
})
