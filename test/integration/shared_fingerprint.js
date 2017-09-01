'use strict'

const chai = require('chai')
const dirtyChai = require('dirty-chai')
const _Primus = require('primus')
const expect = chai.expect
chai.use(dirtyChai)

const request = require('request-promise-native')
const path = require('path')
const ActionheroPrototype = require(path.join(__dirname, '/../../actionhero.js'))
let actionhero = new ActionheroPrototype()
let api

let fingerprint
let url

let connectClient = async (transportOptions) => {
  // get actionheroClient in scope
  const ActionheroClient = eval(api.servers.servers.websocket.compileActionheroClientJS()) // eslint-disable-line

  let S = _Primus.createSocket()
  let clientSocket = new S('http://localhost:' + api.config.servers.web.port, {transport: transportOptions})

  let client = new ActionheroClient({}, clientSocket) // eslint-disable-line
  // await new Promise((resolve) => { setTimeout(resolve, 100) })
  let connectResponse = await new Promise((resolve, reject) => {
    client.connect((error, connectResponse) => {
      if (error) { return reject(error) }
      resolve(connectResponse)
    })
  })

  return {client, connectResponse}
}

describe('Integration: Web Server + Websocket Socket shared fingerprint', () => {
  before(async () => {
    api = await actionhero.start()
    url = 'http://localhost:' + api.config.servers.web.port
  })

  after(async () => { await actionhero.stop() })

  it('should exist when web server been called', async () => {
    let body = await request.get({uri: url + '/api/randomNumber', json: true})
    fingerprint = body.requesterInformation.fingerprint
    let headers = { cookie: api.config.servers.web.fingerprintOptions.cookieKey + '=' + fingerprint }
    let {client, connectResponse} = await connectClient({headers: headers})
    expect(connectResponse.status).to.equal('OK')
    expect(connectResponse.data.id).to.be.ok()
    let id = connectResponse.data.id
    expect(api.connections.connections[id].fingerprint).to.equal(fingerprint)
    client.disconnect()
  })

  it('should not exist when web server has not been called', async () => {
    let {client, connectResponse} = await connectClient({})
    expect(connectResponse.status).to.equal('OK')
    expect(connectResponse.data.id).to.be.ok()
    let id = connectResponse.data.id
    expect(api.connections.connections[id].fingerprint).not.to.equal(fingerprint)
    client.disconnect()
  })

  it('should exist as long as cookie is passed', async () => {
    let headers = { cookie: api.config.servers.web.fingerprintOptions.cookieKey + '=' + 'dummyValue' }
    let {client, connectResponse} = await connectClient({headers: headers})
    expect(connectResponse.status).to.equal('OK')
    expect(connectResponse.data.id).to.be.ok()
    let id = connectResponse.data.id
    expect(api.connections.connections[id].fingerprint).to.equal('dummyValue')
    client.disconnect()
  })
})
