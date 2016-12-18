'use strict'

var request = require('request')
var stream = require('stream')
let path = require('path')
var expect = require('chai').expect
var ActionheroPrototype = require(path.join(__dirname, '/../../actionhero.js'))
var actionhero = new ActionheroPrototype()
var api
var url

describe('Server: sendBuffer', () => {
  before((done) => {
    actionhero.start((error, a) => {
      expect(error).to.be.null
      api = a
      url = 'http://localhost:' + api.config.servers.web.port
      done()
    })
  })

  after((done) => {
    actionhero.stop(() => {
      done()
    })
  })

  describe('errors', () => {
    before(() => {
      api.actions.versions.sendBufferTest = [1]
      api.actions.actions.sendBufferTest = {
        '1': {
          name: 'sendBufferTest',
          description: 'sendBufferTest',
          version: 1,
          run: (api, data, next) => {
            const buffer = 'Example of data buffer'
            let bufferStream = new stream.PassThrough()
            bufferStream.end(buffer)
            data.connection.rawConnection.responseHeaders.push(['Content-Disposition', 'attachment; filename=test.csv'])
            api.servers.servers.web.sendFile(data.connection, null, bufferStream, 'text/csv', buffer.length, new Date())
            data.toRender = false
            next()
          }
        }
      }

      api.routes.loadRoutes()
    })

    after(() => {
      delete api.actions.actions.sendBufferTest
      delete api.actions.versions.sendBufferTest
    })

    it('Server should sendBuffer', (done) => {
      request.get(url + '/api/sendBufferTest', (error, response, body) => {
        expect(error).to.be.null
        expect(body).to.equal('Example of data buffer')
        done()
      })
    })
  })
})
