'use strict'

const _Primus = require('primus')
const request = require('request-promise-native')
const path = require('path')
const ActionHero = require(path.join(__dirname, '/../../index.js'))
let actionhero = new ActionHero.Process()
let api
let ActionheroWebsocketClient
let fingerprint
let url

let connectClient = async (query) => {
  let S = _Primus.createSocket()
  let clientSocket = new S(`http://localhost:${api.config.servers.web.port}?${query}`)

  let client = new ActionheroWebsocketClient({}, clientSocket) // eslint-disable-line
  let connectResponse = await new Promise((resolve, reject) => {
    client.connect((error, connectResponse) => {
      if (error) { return reject(error) }
      resolve(connectResponse)
    })
  })

  return {client, connectResponse}
}

describe('Integration: Web Server + Websocket Socket shared fingerprint', () => {
  beforeAll(async () => {
    api = await actionhero.start()
    url = 'http://localhost:' + api.config.servers.web.port
    ActionheroWebsocketClient = eval(api.servers.servers.websocket.compileActionheroWebsocketClientJS()) // eslint-disable-line
  })

  afterAll(async () => { await actionhero.stop() })

  test('should exist when web server been called', async () => {
    let body = await request.get({uri: url + '/api/randomNumber', json: true})
    fingerprint = body.requesterInformation.fingerprint
    let query = `${api.config.servers.web.fingerprintOptions.cookieKey}=${fingerprint}`
    let {client, connectResponse} = await connectClient(query)
    expect(connectResponse.status).toEqual('OK')
    expect(connectResponse.data.id).toBeTruthy()
    let id = connectResponse.data.id
    expect(api.connections.connections[id].fingerprint).toEqual(fingerprint)
    client.disconnect()
  })

  test('should not exist when web server has not been called', async () => {
    let {client, connectResponse} = await connectClient()
    expect(connectResponse.status).toEqual('OK')
    expect(connectResponse.data.id).toBeTruthy()
    let id = connectResponse.data.id
    expect(api.connections.connections[id].fingerprint).not.toEqual(fingerprint)
    client.disconnect()
  })

  test('should exist as long as cookie is passed', async () => {
    let query = `${api.config.servers.web.fingerprintOptions.cookieKey}=dummyValue`
    let {client, connectResponse} = await connectClient(query)
    expect(connectResponse.status).toEqual('OK')
    expect(connectResponse.data.id).toBeTruthy()
    let id = connectResponse.data.id
    expect(api.connections.connections[id].fingerprint).toEqual('dummyValue')
    client.disconnect()
  })
})
