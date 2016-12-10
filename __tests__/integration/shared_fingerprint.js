var request = require('request')
var path = require('path')
var ActionheroPrototype = require(path.join(__dirname, '/../../actionhero.js'))
var actionhero = new ActionheroPrototype()
var api

var client
var fingerprint
var url
var cookieHeader
var oldRequest

var connectClient = (callback) => {
  // get actionheroClient in scope
  eval(api.servers.servers.websocket.compileActionheroClientJS()) // eslint-disable-line

  var S = api.servers.servers.websocket.server.Socket
  var url = 'http://localhost:' + api.config.servers.web.port
  var clientSocket = new S(url)

  client = new ActionheroClient({}, clientSocket) // eslint-disable-line
  setTimeout(callback, 100)
}

describe('Integration: Web Server + Websocket Socket shared fingerprint', () => {
  beforeAll((done) => {
    actionhero.start((error, a) => {
      expect(error).toBeNull()
      api = a
      url = 'http://localhost:' + api.config.servers.web.port
      api.config.servers.websocket.clientUrl = 'http://localhost:' + api.config.servers.web.port
      done()
    })
  })

  afterAll((done) => {
    actionhero.stop(done)
  })

  beforeEach((done) => {
    cookieHeader = ''
    connectClient(done)
  })

  afterEach(() => {
    try {
      client.disconnect()
    } catch (e) {
      //
    }
  })

  beforeAll(() => {
    // Override http.request to test fingerprint
    var module = require('http')
    oldRequest = module.request
    module.request = function (options, callback) {
      options.headers.Cookie = cookieHeader
      return oldRequest.apply(module, arguments)
    }
  })

  afterAll(() => {
    // Restore http.request
    var module = require('http')
    module.request = oldRequest
  })

  it('should exist when web server been called', (done) => {
    request.get(url + '/api/', (error, response, body) => {
      expect(error).toBeNull()
      body = JSON.parse(body)
      fingerprint = body.requesterInformation.fingerprint
      cookieHeader = response.headers['set-cookie'][0]
      client.connect((error, response) => {
        expect(error).toBeNull()
        expect(response.status).toBe('OK')
        expect(response.data.id).toBeTruthy()
        var id = response.data.id
        expect(api.connections.connections[id].fingerprint).toBe(fingerprint)
        done()
      })
    })
  })

  it('should not exist when web server has not been called', (done) => {
    client.connect((error, response) => {
      expect(error).toBeNull()
      expect(response.status).toBe('OK')
      expect(response.data.id).toBeTruthy()
      var id = response.data.id
      expect(api.connections.connections[id].fingerprint).not.toBe(fingerprint)
      done()
    })
  })

  it('should exist as long as cookie is passed', (done) => {
    cookieHeader = api.config.servers.web.fingerprintOptions.cookieKey + '=dummyValue'
    client.connect((error, response) => {
      expect(error).toBeNull()
      expect(response.status).toBe('OK')
      expect(response.data.id).toBeTruthy()
      var id = response.data.id
      expect(api.connections.connections[id].fingerprint).toBe('dummyValue')
      done()
    })
  })
})
