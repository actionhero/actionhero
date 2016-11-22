'use strict'

var should = require('should')
var request = require('request')
var stream = require('stream')
let path = require('path')
var ActionheroPrototype = require(path.join(__dirname, '/../../actionhero.js'))
var actionhero = new ActionheroPrototype()
var api
var url

describe('Server: sendBuffer', function () {
  before(function (done) {
    actionhero.start(function (error, a) {
      should.not.exist(error)
      api = a
      url = 'http://localhost:' + api.config.servers.web.port
      done()
    })
  })

  after(function (done) {
    actionhero.stop(function () {
      done()
    })
  })

  describe('errors', function () {
    before(function () {
      api.actions.versions.sendBufferTest = [1]
      api.actions.actions.sendBufferTest = {
        '1': {
          name: 'sendBufferTest',
          description: 'sendBufferTest',
          version: 1,
          run: function (api, data, next) {
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

    after(function () {
      delete api.actions.actions.sendBufferTest
      delete api.actions.versions.sendBufferTest
    })

    it('Server should sendBuffer', function (done) {
      request.get(url + '/api/sendBufferTest', function (error, response, body) {
        should.not.exist(error)
        body.should.equal('Example of data buffer')
        done()
      })
    })
  })
})
