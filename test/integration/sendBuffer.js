'use strict'

const chai = require('chai')
const dirtyChai = require('dirty-chai')
const expect = chai.expect
chai.use(dirtyChai)

const request = require('request-promise-native')
const stream = require('stream')
const path = require('path')
const ActionHero = require(path.join(__dirname, '/../../index.js'))
const actionhero = new ActionHero.Process()
let api
let url

describe('Server: sendBuffer', () => {
  before(async () => {
    api = await actionhero.start()
    url = 'http://localhost:' + api.config.servers.web.port
  })

  after(async () => { await actionhero.stop() })

  before(() => {
    api.actions.versions.sendBufferTest = [1]
    api.actions.actions.sendBufferTest = {
      '1': {
        name: 'sendBufferTest',
        description: 'sendBufferTest',
        version: 1,
        run: async (data) => {
          const buffer = 'Example of data buffer'
          let bufferStream = new stream.PassThrough()
          data.connection.rawConnection.responseHeaders.push(['Content-Disposition', 'attachment; filename=test.csv'])
          api.servers.servers.web.sendFile(data.connection, null, bufferStream, 'text/csv', buffer.length, new Date())
          data.toRender = false
          bufferStream.end(buffer)
        }
      }
    }

    api.actions.versions.sendUnknownLengthBufferTest = [1]
    api.actions.actions.sendUnknownLengthBufferTest = {
      '1': {
        name: 'sendUnknownLengthBufferTest',
        description: 'sendUnknownLengthBufferTest',
        version: 1,
        run: (data) => {
          let bufferStream = new stream.PassThrough()
          api.servers.servers.web.sendFile(data.connection, null, bufferStream, 'text/plain', null, new Date())
          const buffer = 'Example of unknown length data buffer'
          data.toRender = false
          bufferStream.end(buffer)
        }
      }
    }

    api.routes.loadRoutes()
  })

  after(() => {
    delete api.actions.actions.sendBufferTest
    delete api.actions.versions.sendBufferTest
    delete api.actions.versions.sendUnknownLengthBufferTest
    delete api.actions.versions.sendUnknownLengthBufferTest
    api.routes.loadRoutes()
  })

  it('Server should sendBuffer', async () => {
    let body = await request.get(url + '/api/sendBufferTest')
    expect(body).to.equal('Example of data buffer')
  })

  it('Server should send a stream with no specified length', async () => {
    let {body, headers} = await request.get({
      uri: url + '/api/sendUnknownLengthBufferTest',
      resolveWithFullResponse: true
    })

    expect(headers).to.not.have.property('content-length')
    expect(body).to.equal('Example of unknown length data buffer')
  })
})
