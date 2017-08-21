// 'use strict'
// we cannot use strict here because we want EVAL to work

const chai = require('chai')
const dirtyChai = require('dirty-chai')
const _Primus = require('primus')
const expect = chai.expect
chai.use(dirtyChai)

const request = require('request')
const path = require('path')
const ActionheroPrototype = require(path.join(__dirname, '/../../actionhero.js'))
let actionhero = new ActionheroPrototype()
let api

let fingerprint
let url

let connectClient = (transportOptions, callback) => {
  // get actionheroClient in scope
  eval(api.servers.servers.websocket.compileActionheroClientJS()) // eslint-disable-line

  let S = _Primus.createSocket()
  let clientSocket = new S('http://localhost:' + api.config.servers.web.port, {transport: transportOptions})

  let client = new ActionheroClient({}, clientSocket) // eslint-disable-line
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
      let headers = { cookie: api.config.servers.web.fingerprintOptions.cookieKey + '=' + fingerprint }

      connectClient({headers: headers}, (error, client) => {
        expect(error).to.be.null()
        client.connect((error, response) => {
          expect(error).to.be.null()
          expect(response.status).to.equal('OK')
          expect(response.data.id).to.be.ok()
          let id = response.data.id
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
        let id = response.data.id
        expect(api.connections.connections[id].fingerprint).not.to.equal(fingerprint)
        client.disconnect()
        done()
      })
    })
  })

  it('should exist as long as cookie is passed', (done) => {
    let headers = { cookie: api.config.servers.web.fingerprintOptions.cookieKey + '=' + 'dummyValue' }
    connectClient({headers: headers}, (error, client) => {
      expect(error).to.be.null()
      client.connect((error, response) => {
        expect(error).to.be.null()
        expect(response.status).to.equal('OK')
        expect(response.data.id).to.be.ok()
        let id = response.data.id
        expect(api.connections.connections[id].fingerprint).to.equal('dummyValue')
        client.disconnect()
        done()
      })
    })
  })
})
