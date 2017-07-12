'use strict'

var chai = require('chai')
var dirtyChai = require('dirty-chai')
var expect = chai.expect
chai.use(dirtyChai)

var request = require('request')
var fs = require('fs')
var os = require('os')
let path = require('path')
var ActionheroPrototype = require(path.join(__dirname, '/../../actionhero.js'))
var actionhero = new ActionheroPrototype()
var api
var url

describe('Server: Web', () => {
  before((done) => {
    actionhero.start((error, a) => {
      expect(error).to.be.null()
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

  it('file: 404 pages from POST with if-modified-since header', (done) => {
    var file = Math.random().toString(36)
    var options = {
      url: url + '/' + file,
      headers: {
        'if-modified-since': 'Thu, 19 Apr 2012 09:51:20 GMT'
      }
    }

    request.get(options, (error, response, body) => {
      expect(error).to.be.null()
      expect(response.statusCode).to.equal(404)
      expect(response.body).to.equal('That file is not found')
      done()
    })
  })

  it('Server should be up and return data', (done) => {
    request.get(url + '/api/', (error, response, body) => {
      expect(error).to.be.null()
      body = JSON.parse(body)
      expect(body).to.be.instanceof(Object)
      done()
    })
  })

  it('Server basic response should be JSON and have basic data', (done) => {
    request.get(url + '/api/', (error, response, body) => {
      expect(error).to.be.null()
      body = JSON.parse(body)
      expect(body).to.be.instanceof(Object)
      expect(body.requesterInformation).to.be.instanceof(Object)
      done()
    })
  })

  it('params work', (done) => {
    request.get(url + '/api?key=value', (error, response, body) => {
      expect(error).to.be.null()
      body = JSON.parse(body)
      expect(body.requesterInformation.receivedParams.key).to.equal('value')
      done()
    })
  })

  it('params are ignored unless they are in the whitelist', (done) => {
    request.get(url + '/api?crazyParam123=something', (error, response, body) => {
      expect(error).to.be.null()
      body = JSON.parse(body)
      expect(body.requesterInformation.receivedParams.crazyParam123).to.not.exist()
      done()
    })
  })

  describe('will properly destroy connections', () => {
    before(() => {
      api.config.servers.web.returnErrorCodes = true
      api.actions.versions.customRender = [1]
      api.actions.actions.customRender = {
        '1': {
          name: 'customRender',
          description: 'I am a test',
          version: 1,
          outputExample: {},
          run: (api, data, next) => {
            data.toRender = false
            process.nextTick(() => {
              data.connection.rawConnection.res.writeHead(200, { 'Content-Type': 'text/plain' })
              data.connection.rawConnection.res.end(`${Math.random()}`)
              next(null)
            })
          }
        }
      }

      api.routes.loadRoutes()
    })

    after(() => {
      delete api.actions.actions.customRender
      delete api.actions.versions.customRender
    })

    it('works for the API', (done) => {
      expect(Object.keys(api.connections.connections)).to.have.length(0)
      request.get(url + '/api/sleepTest', (error, body, response) => {
        expect(error).to.be.null()
        expect(Object.keys(api.connections.connections)).to.have.length(0)
        setTimeout(done, 100)
      })

      setTimeout(() => {
        expect(Object.keys(api.connections.connections)).to.have.length(1)
      }, 100)
    })

    it('works for files', (done) => {
      expect(Object.keys(api.connections.connections)).to.have.length(0)
      request.get(url + '/simple.html', (error) => {
        expect(error).to.be.null()
        setTimeout(() => {
          expect(Object.keys(api.connections.connections)).to.have.length(0)
          done()
        }, 100)
      })
    })

    it('works for actions with toRender: false', (done) => {
      expect(Object.keys(api.connections.connections)).to.have.length(0)
      request.get(url + '/api/customRender', (error) => {
        expect(error).to.be.null()
        setTimeout(() => {
          expect(Object.keys(api.connections.connections)).to.have.length(0)
          done()
        }, 100)
      })
    })
  })

  describe('errors', () => {
    before((done) => {
      api.actions.versions.stringErrorTestAction = [1]
      api.actions.actions.stringErrorTestAction = {
        '1': {
          name: 'stringErrorTestAction',
          description: 'stringErrorTestAction',
          version: 1,
          run: (api, data, next) => {
            next('broken')
          }
        }
      }

      api.actions.versions.errorErrorTestAction = [1]
      api.actions.actions.errorErrorTestAction = {
        '1': {
          name: 'errorErrorTestAction',
          description: 'errorErrorTestAction',
          version: 1,
          run: (api, data, next) => {
            next(new Error('broken'))
          }
        }
      }

      api.actions.versions.complexErrorTestAction = [1]
      api.actions.actions.complexErrorTestAction = {
        '1': {
          name: 'complexErrorTestAction',
          description: 'complexErrorTestAction',
          version: 1,
          run: (api, data, next) => {
            next({error: 'broken', reason: 'stuff'})
          }
        }
      }

      api.routes.loadRoutes()
      done()
    })

    after((done) => {
      delete api.actions.actions.stringErrorTestAction
      delete api.actions.versions.stringErrorTestAction
      delete api.actions.actions.errorErrorTestAction
      delete api.actions.versions.errorErrorTestAction
      delete api.actions.actions.complexErrorTestAction
      delete api.actions.versions.complexErrorTestAction
      done()
    })

    it('errors can be error strings', (done) => {
      request.get(url + '/api/stringErrorTestAction/', (error, response, body) => {
        expect(error).to.be.null()
        body = JSON.parse(body)
        expect(body.error).to.equal('broken')
        done()
      })
    })

    it('errors can be error objects and returned plainly', (done) => {
      request.get(url + '/api/errorErrorTestAction/', (error, response, body) => {
        expect(error).to.be.null()
        body = JSON.parse(body)
        expect(body.error).to.equal('broken')
        done()
      })
    })

    it('errors can be complex JSON payloads', (done) => {
      request.get(url + '/api/complexErrorTestAction/', (error, response, body) => {
        expect(error).to.be.null()
        body = JSON.parse(body)
        expect(body.error.error).to.equal('broken')
        expect(body.error.reason).to.equal('stuff')
        done()
      })
    })
  })

  describe('if disableParamScrubbing is set ', () => {
    var orig

    before((done) => {
      orig = api.config.general.disableParamScrubbing
      api.config.general.disableParamScrubbing = true
      done()
    })

    after((done) => {
      api.config.general.disableParamScrubbing = orig
      done()
    })

    it('params are not ignored', (done) => {
      request.get(url + '/api/testAction/?crazyParam123=something', (error, response, body) => {
        expect(error).to.be.null()
        body = JSON.parse(body)
        expect(body.requesterInformation.receivedParams.crazyParam123).to.equal('something')
        done()
      })
    })
  })

  describe('JSONp', () => {
    before(() => { api.config.servers.web.metadataOptions.requesterInformation = false })
    after(() => { api.config.servers.web.metadataOptions.requesterInformation = true })

    it('can ask for JSONp responses', (done) => {
      request.get(url + '/api/randomNumber?callback=myCallback', (error, response, body) => {
        expect(error).to.be.null()
        expect(body.indexOf('myCallback({')).to.equal(0)
        done()
      })
    })

    it('JSONp responses cannot be used for XSS', (done) => {
      request.get(url + '/api/randomNumber?callback=alert(%27hi%27);foo', (error, response, body) => {
        expect(error).to.be.null()
        expect(body).not.to.match(/alert\(/)
        expect(body.indexOf('alert&#39;hi&#39;;foo(')).to.equal(0)
        done()
      })
    })
  })

  describe('request redirecton (allowedRequestHosts)', () => {
    before(() => { api.config.servers.web.allowedRequestHosts = ['https://www.site.com'] })
    after(() => { api.config.servers.web.allowedRequestHosts = [] })

    it('will redirect clients if they do not request the proper host', (done) => {
      request.get({
        followRedirect: false,
        url: url + '/api/randomNumber',
        headers: {'Host': 'lalala.site.com'}
      }, (error, response, body) => {
        expect(error).to.be.null()
        expect(response.headers.location).to.equal('https://www.site.com/api/randomNumber')
        expect(body).to.match(/You are being redirected to https:\/\/www.site.com\/api\/randomNumber/)
        done()
      })
    })

    it('will allow API access from the proper hosts', (done) => {
      request.get({
        followRedirect: false,
        url: url + '/api/randomNumber',
        headers: {
          'Host': 'www.site.com',
          'x-forwarded-proto': 'https'
        }
      }, (error, response, body) => {
        expect(error).to.be.null()
        expect(response.headers.location).to.not.exist()
        expect(body).to.match(/randomNumber/)
        done()
      })
    })
  })

  it('gibberish actions have the right response', (done) => {
    request.get(url + '/api/IAMNOTANACTION', (error, response, body) => {
      expect(error).to.be.null()
      body = JSON.parse(body)
      expect(body.error).to.equal('unknown action or invalid apiVersion')
      done()
    })
  })

  it('real actions do not have an error response', (done) => {
    request.get(url + '/api/status', (error, response, body) => {
      expect(error).to.be.null()
      body = JSON.parse(body)
      expect(body.error).to.not.exist()
      done()
    })
  })

  it('HTTP Verbs should work: GET', (done) => {
    request.get(url + '/api/randomNumber', (error, response, body) => {
      expect(error).to.be.null()
      body = JSON.parse(body)
      expect(body.randomNumber).to.be.at.least(0)
      expect(body.randomNumber).to.be.at.most(1)
      done()
    })
  })

  it('HTTP Verbs should work: PUT', (done) => {
    request.put(url + '/api/randomNumber', (error, response, body) => {
      expect(error).to.be.null()
      body = JSON.parse(body)
      expect(body.randomNumber).to.be.at.least(0)
      expect(body.randomNumber).to.be.at.most(1)
      done()
    })
  })

  it('HTTP Verbs should work: POST', (done) => {
    request.post(url + '/api/randomNumber', (error, response, body) => {
      expect(error).to.be.null()
      body = JSON.parse(body)
      expect(body.randomNumber).to.be.at.least(0)
      expect(body.randomNumber).to.be.at.most(100)
      done()
    })
  })

  it('HTTP Verbs should work: DELETE', (done) => {
    request.del(url + '/api/randomNumber', (error, response, body) => {
      expect(error).to.be.null()
      body = JSON.parse(body)
      expect(body.randomNumber).to.be.at.least(0)
      expect(body.randomNumber).to.be.at.most(1000)
      done()
    })
  })

  it('HTTP Verbs should work: Post with Form', (done) => {
    request.post(url + '/api/cacheTest', {form: {key: 'key', value: 'value'}}, (error, response, body) => {
      expect(error).to.be.null()
      body = JSON.parse(body)
      expect(body.cacheTestResults.saveResp).to.equal(true)
      done()
    })
  })

  it('HTTP Verbs should work: Post with JSON Payload as body', (done) => {
    var body = JSON.stringify({key: 'key', value: 'value'})
    request.post(url + '/api/cacheTest', {'body': body, 'headers': {'Content-type': 'application/json'}}, (error, response, body) => {
      expect(error).to.be.null()
      body = JSON.parse(body)
      expect(body.cacheTestResults.saveResp).to.equal(true)
      done()
    })
  })

  describe('connection.rawConnection.params', () => {
    before((done) => {
      api.actions.versions.paramTestAction = [1]
      api.actions.actions.paramTestAction = {
        '1': {
          name: 'paramTestAction',
          description: 'I return connection.rawConnection.params',
          version: 1,
          run: (api, data, next) => {
            data.response = data.connection.rawConnection.params
            if (data.connection.rawConnection.params.rawBody) {
              data.response.rawBody = data.connection.rawConnection.params.rawBody.toString()
            }
            next()
          }
        }
      }

      api.routes.loadRoutes()
      done()
    })

    after((done) => {
      delete api.actions.actions.paramTestAction
      delete api.actions.versions.paramTestAction
      done()
    })

    it('.query should contain unfiltered query params', (done) => {
      request.get(url + '/api/paramTestAction/?crazyParam123=something', (error, response, body) => {
        expect(error).to.be.null()
        body = JSON.parse(body)
        expect(body.query.crazyParam123).to.equal('something')
        done()
      })
    })

    it('.body should contain unfiltered. parsed request body params', (done) => {
      var requestBody = JSON.stringify({key: 'value'})
      request.post(url + '/api/paramTestAction', {'body': requestBody, 'headers': {'Content-type': 'application/json'}}, (error, response, body) => {
        expect(error).to.be.null()
        body = JSON.parse(body)
        expect(body.body.key).to.equal('value')
        done()
      })
    })

    describe('connection.rawConnection.rawBody', () => {
      after(() => { api.config.servers.web.saveRawBody = false })

      it('.rawBody will contain the raw POST body without parsing', (done) => {
        api.config.servers.web.saveRawBody = true
        let requestBody = '{"key":      "value"}'
        request.post(url + '/api/paramTestAction', {'body': requestBody, 'headers': {'Content-type': 'application/json'}}, (error, response, body) => {
          expect(error).to.be.null()
          body = JSON.parse(body)
          expect(body.body.key).to.equal('value')
          expect(body.rawBody).to.equal('{"key":      "value"}')
          done()
        })
      })

      it('.rawBody can be disabled', (done) => {
        api.config.servers.web.saveRawBody = false
        let requestBody = '{"key":      "value"}'
        request.post(url + '/api/paramTestAction', {'body': requestBody, 'headers': {'Content-type': 'application/json'}}, (error, response, body) => {
          expect(error).to.be.null()
          body = JSON.parse(body)
          expect(body.body.key).to.equal('value')
          expect(body.rawBody).to.equal('')
          done()
        })
      })
    })
  })

  it('returnErrorCodes false should still have a status of 200', (done) => {
    api.config.servers.web.returnErrorCodes = false
    request.del(url + '/api/', (error, response, body) => {
      expect(error).to.be.null()
      body = JSON.parse(body)
      expect(response.statusCode).to.equal(200)
      done()
    })
  })

  it('returnErrorCodes can be opted to change http header codes', (done) => {
    api.config.servers.web.returnErrorCodes = true
    request.del(url + '/api/', (error, response, body) => {
      expect(error).to.be.null()
      body = JSON.parse(body)
      expect(response.statusCode).to.equal(404)
      done()
    })
  })

  describe('http header', () => {
    before((done) => {
      api.config.servers.web.returnErrorCodes = true
      api.actions.versions.headerTestAction = [1]
      api.actions.actions.headerTestAction = {
        '1': {
          name: 'headerTestAction',
          description: 'I am a test',
          version: 1,
          outputExample: {},
          run: (api, data, next) => {
            data.connection.rawConnection.responseHeaders.push(['thing', 'A'])
            data.connection.rawConnection.responseHeaders.push(['thing', 'B'])
            data.connection.rawConnection.responseHeaders.push(['thing', 'C'])
            data.connection.rawConnection.responseHeaders.push(['Set-Cookie', 'value_1=1'])
            data.connection.rawConnection.responseHeaders.push(['Set-Cookie', 'value_2=2'])
            next()
          }
        }
      }

      api.routes.loadRoutes()
      done()
    })

    after((done) => {
      delete api.actions.actions.headerTestAction
      delete api.actions.versions.headerTestAction
      done()
    })

    it('duplicate headers should be removed (in favor of the last set)', (done) => {
      request.get(url + '/api/headerTestAction', (error, response, body) => {
        expect(error).to.be.null()
        body = JSON.parse(body)
        expect(response.statusCode).to.equal(200)
        expect(response.headers.thing).to.equal('C')
        done()
      })
    })

    it('but duplicate set-cookie requests should be allowed', (done) => {
      request.get(url + '/api/headerTestAction', (error, response, body) => {
        expect(error).to.be.null()
        body = JSON.parse(body)
        expect(response.statusCode).to.equal(200)
        expect(response.headers['set-cookie']).to.have.length(3) // 2 + session
        expect(response.headers['set-cookie'][1]).to.equal('value_1=1')
        expect(response.headers['set-cookie'][0]).to.equal('value_2=2')
        done()
      })
    })

    it('should respond to OPTIONS with only HTTP headers', (done) => {
      request({method: 'options', url: url + '/api/cacheTest'}, (error, response) => {
        expect(error).to.be.null()
        expect(response.statusCode).to.equal(200)
        expect(response.headers['access-control-allow-methods']).to.equal('HEAD, GET, POST, PUT, PATCH, DELETE, OPTIONS, TRACE')
        expect(response.headers['access-control-allow-origin']).to.equal('*')
        expect(response.headers['content-length']).to.equal('0')
        done()
      })
    })

    it('should respond to TRACE with parsed params received', (done) => {
      request({method: 'trace', url: url + '/api/x', form: {key: 'someKey', value: 'someValue'}}, (error, response, body) => {
        expect(error).to.be.null()
        body = JSON.parse(body)
        expect(response.statusCode).to.equal(200)
        expect(body.receivedParams.key).to.equal('someKey')
        expect(body.receivedParams.value).to.equal('someValue')
        done()
      })
    })

    it('should respond to HEAD requests just like GET, but with no body', (done) => {
      request({method: 'head', url: url + '/api/headerTestAction'}, (error, response, body) => {
        expect(error).to.be.null()
        expect(response.statusCode).to.equal(200)
        expect(body).to.equal('')
        done()
      })
    })

    it('keeps sessions with browser_fingerprint', (done) => {
      var j = request.jar()
      request.post({url: url + '/api', jar: j}, (error, response1, body1) => {
        expect(error).to.be.null()
        request.get({url: url + '/api', jar: j}, (error, response2, body2) => {
          expect(error).to.be.null()
          request.put({url: url + '/api', jar: j}, (error, response3, body3) => {
            expect(error).to.be.null()
            request.del({url: url + '/api', jar: j}, (error, response4, body4) => {
              expect(error).to.be.null()

              body1 = JSON.parse(body1)
              body2 = JSON.parse(body2)
              body3 = JSON.parse(body3)
              body4 = JSON.parse(body4)

              expect(response1.headers['set-cookie']).to.be.ok()
              expect(response2.headers['set-cookie']).to.not.exist()
              expect(response3.headers['set-cookie']).to.not.exist()
              expect(response4.headers['set-cookie']).to.not.exist()

              var fingerprint1 = body1.requesterInformation.id.split('-')[0]
              var fingerprint2 = body2.requesterInformation.id.split('-')[0]
              var fingerprint3 = body3.requesterInformation.id.split('-')[0]
              var fingerprint4 = body4.requesterInformation.id.split('-')[0]

              expect(fingerprint1).to.equal(fingerprint2)
              expect(fingerprint1).to.equal(fingerprint3)
              expect(fingerprint1).to.equal(fingerprint4)

              expect(fingerprint1).to.equal(body1.requesterInformation.fingerprint)
              expect(fingerprint2).to.equal(body2.requesterInformation.fingerprint)
              expect(fingerprint3).to.equal(body3.requesterInformation.fingerprint)
              expect(fingerprint4).to.equal(body4.requesterInformation.fingerprint)
              done()
            })
          })
        })
      })
    })
  })

  describe('http returnErrorCodes true', () => {
    before((done) => {
      api.config.servers.web.returnErrorCodes = true

      api.actions.versions.statusTestAction = [1]
      api.actions.actions.statusTestAction = {
        '1': {
          name: 'statusTestAction',
          description: 'I am a test',
          inputs: {
            key: {required: true}
          },
          run: (api, data, next) => {
            var error
            if (data.params.key !== 'value') {
              error = 'key != value'
              data.connection.rawConnection.responseHttpCode = 402
            } else {
              data.response.good = true
            }
            next(error)
          }
        }
      }

      api.routes.loadRoutes()
      done()
    })

    after((done) => {
      api.config.servers.web.returnErrorCodes = false
      delete api.actions.versions.statusTestAction
      delete api.actions.actions.statusTestAction
      done()
    })

    it('actions that do not exists should return 404', (done) => {
      request.post(url + '/api/aFakeAction', (error, response, body) => {
        expect(error).to.be.null()
        body = JSON.parse(body)
        expect(response.statusCode).to.equal(404)
        done()
      })
    })

    it('missing params result in a 422', (done) => {
      request.post(url + '/api/statusTestAction', (error, response, body) => {
        expect(error).to.be.null()
        body = JSON.parse(body)
        expect(response.statusCode).to.equal(422)
        done()
      })
    })

    it('status codes can be set for errors', (done) => {
      request.post(url + '/api/statusTestAction', {form: {key: 'bannana'}}, (error, response, body) => {
        expect(error).to.be.null()
        body = JSON.parse(body)
        expect(body.error).to.equal('key != value')
        expect(response.statusCode).to.equal(402)
        done()
      })
    })

    it('status code should still be 200 if everything is OK', (done) => {
      request.post(url + '/api/statusTestAction', {form: {key: 'value'}}, (error, response, body) => {
        expect(error).to.be.null()
        body = JSON.parse(body)
        expect(body.good).to.equal(true)
        expect(response.statusCode).to.equal(200)
        done()
      })
    })
  })

  describe('documentation', () => {
    it('documentation can be returned via a documentation action', (done) => {
      request.get(url + '/api/showDocumentation', (error, response, body) => {
        expect(error).to.be.null()
        body = JSON.parse(body)
        expect(body.documentation).to.be.instanceof(Object)
        done()
      })
    })

    it('should have actions with all the right parts', (done) => {
      request.get(url + '/api/showDocumentation', (error, response, body) => {
        expect(error).to.be.null()
        body = JSON.parse(body)
        for (var actionName in body.documentation) {
          for (var version in body.documentation[actionName]) {
            var action = body.documentation[actionName][version]
            expect(typeof action.name).to.equal('string')
            expect(typeof action.description).to.equal('string')
            expect(action.inputs).to.be.instanceof(Object)
          }
        }
        done()
      })
    })
  })

  describe('files', () => {
    it('file: an HTML file', (done) => {
      request.get(url + '/public/simple.html', (error, response) => {
        expect(error).to.be.null()
        expect(response.statusCode).to.equal(200)
        expect(response.body).to.equal('<h1>ActionHero</h1>\\nI am a flat file being served to you via the API from ./public/simple.html<br />')
        done()
      })
    })

    it('file: 404 pages', (done) => {
      request.get(url + '/public/notARealFile', (error, response) => {
        expect(error).to.be.null()
        expect(response.statusCode).to.equal(404)
        expect(response.body).not.to.match(/notARealFile/)
        done()
      })
    })

    it('I should not see files outside of the public dir', (done) => {
      request.get(url + '/public/../config.json', (error, response) => {
        expect(error).to.be.null()
        expect(response.statusCode).to.equal(404)
        expect(response.body).to.equal('That file is not found')
        done()
      })
    })

    it('file: index page should be served when requesting a path (trailing slash)', (done) => {
      request.get(url + '/public/', (error, response) => {
        expect(error).to.be.null()
        expect(response.statusCode).to.equal(200)
        expect(typeof response.body).to.equal('string')
        done()
      })
    })

    it('file: index page should be served when requesting a path (no trailing slash)', (done) => {
      request.get(url + '/public', (error, response) => {
        expect(error).to.be.null()
        expect(response.statusCode).to.equal(200)
        expect(typeof response.body).to.equal('string')
        done()
      })
    })

    describe('can serve files from a specific mapped route', () => {
      before((done) => {
        var testFolderPublicPath = path.join(__dirname, '/../../public/testFolder')
        fs.mkdirSync(testFolderPublicPath)
        fs.writeFileSync(testFolderPublicPath + '/testFile.html', 'ActionHero Route Test File')
        api.routes.registerRoute('get', '/my/public/route', null, null, true, testFolderPublicPath)
        process.nextTick(() => {
          done()
        })
      })

      after((done) => {
        var testFolderPublicPath = path.join(__dirname, '/../../public/testFolder')
        fs.unlinkSync(testFolderPublicPath + path.sep + 'testFile.html')
        fs.rmdirSync(testFolderPublicPath)
        process.nextTick(() => {
          done()
        })
      })

      it('works for routes mapped paths', (done) => {
        request.get(url + '/my/public/route/testFile.html', (error, response) => {
          expect(error).to.be.null()
          expect(response.statusCode).to.equal(200)
          expect(response.body).to.equal('ActionHero Route Test File')
          done()
        })
      })

      it('returns 404 for files not available in route mapped paths', (done) => {
        request.get(url + '/my/public/route/fileNotFound.html', (error, response) => {
          expect(error).to.be.null()
          expect(response.statusCode).to.equal(404)
          done()
        })
      })

      it('I should not see files outside of the mapped dir', (done) => {
        request.get(url + '/my/public/route/../../config/servers/web.js', (error, response) => {
          expect(error).to.be.null()
          expect(response.statusCode).to.equal(404)
          done()
        })
      })
    })

    describe('can serve files from more than one directory', () => {
      var source = path.join(__dirname, '/../../public/simple.html')

      before(() => {
        fs.createReadStream(source).pipe(fs.createWriteStream(os.tmpdir() + path.sep + 'testFile.html'))
        api.staticFile.searchLoactions.push(os.tmpdir())
      })

      after(() => {
        fs.unlinkSync(os.tmpdir() + path.sep + 'testFile.html')
        api.staticFile.searchLoactions.pop()
      })

      it('works for secondary paths', (done) => {
        request.get(url + '/public/testFile.html', (error, response) => {
          expect(error).to.be.null()
          expect(response.statusCode).to.equal(200)
          expect(response.body).to.equal('<h1>ActionHero</h1>\\nI am a flat file being served to you via the API from ./public/simple.html<br />')
          done()
        })
      })
    })

    describe('depth routes', () => {
      before(() => {
        api.config.servers.web.urlPathForActions = '/craz/y/action/path'
        api.config.servers.web.urlPathForFiles = '/a/b/c'
      })

      after(() => {
        api.config.servers.web.urlPathForActions = 'api'
        api.config.servers.web.urlPathForFiles = 'public'
      })

      it('old action routes stop working', (done) => {
        request.get(url + '/api/randomNumber', (error, response) => {
          expect(error).to.be.null()
          expect(response.statusCode).to.equal(404)
          done()
        })
      })

      it('can ask for nested URL actions', (done) => {
        request.get(url + '/craz/y/action/path/randomNumber', (error, response) => {
          expect(error).to.be.null()
          expect(response.statusCode).to.equal(200)
          done()
        })
      })

      it('old file routes stop working', (done) => {
        request.get(url + '/public/simple.html', (error, response) => {
          expect(error).to.be.null()
          expect(response.statusCode).to.equal(404)
          done()
        })
      })

      it('can ask for nested URL files', (done) => {
        request.get(url + '/a/b/c/simple.html', (error, response) => {
          expect(error).to.be.null()
          expect(response.statusCode).to.equal(200)
          expect(response.body).to.equal('<h1>ActionHero</h1>\\nI am a flat file being served to you via the API from ./public/simple.html<br />')
          done()
        })
      })

      it('can ask for nested URL files with depth', (done) => {
        request.get(url + '/a/b/c/css/cosmo.css', (error, response) => {
          expect(error).to.be.null()
          expect(response.statusCode).to.equal(200)
          done()
        })
      })
    })
  })

  describe('routes', () => {
    before((done) => {
      api.actions.versions.mimeTestAction = [1]
      api.actions.actions.mimeTestAction = {
        '1': {
          name: 'mimeTestAction',
          description: 'I am a test',
          matchExtensionMimeType: true,
          inputs: {
            key: {required: true},
            path: {required: false}
          },
          outputExample: {},
          run: (api, data, next) => {
            data.response.matchedRoute = data.connection.matchedRoute
            next()
          }
        }
      }

      api.actions.versions.login = [1, 2]
      api.actions.actions.login = {
        '1': {
          name: 'login',
          description: 'login',
          matchExtensionMimeType: true,
          inputs: {
            user_id: {required: true}
          },
          outputExample: {},
          run: (api, data, next) => {
            data.response.user_id = data.params.user_id
            next()
          }
        },

        '2': {
          name: 'login',
          description: 'login',
          matchExtensionMimeType: true,
          inputs: {
            userID: {required: true}
          },
          outputExample: {},
          run: (api, data, next) => {
            data.response.userID = data.params.userID
            next()
          }
        }
      }

      api.params.buildPostVariables()
      api.routes.loadRoutes({
        all: [
          {path: '/user/:userID', action: 'user'}
        ],
        get: [
          {path: '/bogus/:bogusID', action: 'bogusAction'},
          {path: '/users', action: 'usersList'},
          {path: '/c/:key/:value', action: 'cacheTest'},
          {path: '/mimeTestAction/:key', action: 'mimeTestAction'},
          {path: '/thing', action: 'thing'},
          {path: '/thing/stuff', action: 'thingStuff'},
          {path: '/old_login', action: 'login', apiVersion: '1'},
          {path: '/a/wild/:key/:path(^.*$)', action: 'mimeTestAction', apiVersion: '1', matchTrailingPathParts: true}
        ],
        post: [
          {path: '/login/:userID(^(\\d{3}|admin)$)', action: 'login'}
        ]
      })

      done()
    })

    after((done) => {
      api.routes.routes = {}
      delete api.actions.versions.mimeTestAction
      delete api.actions.actions.mimeTestAction
      delete api.actions.versions.login
      delete api.actions.actions.login
      done()
    })

    it('new params will not be allowed in route definitions (an action should do it)', (done) => {
      expect(api.params.postVariables).not.to.contain('bogusID')
      done()
    })

    it('\'all\' routes are duplicated properly', (done) => {
      ['get', 'post', 'put', 'delete'].forEach((verb) => {
        expect(api.routes.routes[verb][0].action).to.equal('user')
        expect(api.routes.routes[verb][0].path).to.equal('/user/:userID')
      })
      done()
    })

    it('unknown actions are still unknown', (done) => {
      request.get(url + '/api/a_crazy_action', (error, response, body) => {
        expect(error).to.be.null()
        body = JSON.parse(body)
        expect(body.error).to.equal('unknown action or invalid apiVersion')
        done()
      })
    })

    it('explicit action declarations still override routed actions, if the defined action is real', (done) => {
      request.get(url + '/api/user/123?action=randomNumber', (error, response, body) => {
        expect(error).to.be.null()
        body = JSON.parse(body)
        expect(body.requesterInformation.receivedParams.action).to.equal('randomNumber')
        done()
      })
    })

    it('route actions will override explicit actions, if the defined action is null', (done) => {
      request.get(url + '/api/user/123?action=someFakeAction', (error, response, body) => {
        expect(error).to.be.null()
        body = JSON.parse(body)
        expect(body.requesterInformation.receivedParams.action).to.equal('user')
        done()
      })
    })

    it('route actions have the matched route availalbe to the action', (done) => {
      request.get(url + '/api/mimeTestAction/thing.json', (error, response, body) => {
        expect(error).to.be.null()
        body = JSON.parse(body)
        expect(body.matchedRoute.path).to.equal('/mimeTestAction/:key')
        expect(body.matchedRoute.action).to.equal('mimeTestAction')
        done()
      })
    })

    it('Routes should recognize apiVersion as default param', (done) => {
      request.get(url + '/api/old_login?user_id=7', (error, response, body) => {
        expect(error).to.be.null()
        body = JSON.parse(body)
        expect(body.user_id).to.equal('7')
        expect(body.requesterInformation.receivedParams.action).to.equal('login')
        done()
      })
    })

    it('Routes should be mapped for GET (simple)', (done) => {
      request.get(url + '/api/users', (error, response, body) => {
        expect(error).to.be.null()
        body = JSON.parse(body)
        expect(body.requesterInformation.receivedParams.action).to.equal('usersList')
        done()
      })
    })

    it('Routes should be mapped for GET (complex)', (done) => {
      request.get(url + '/api/user/1234', (error, response, body) => {
        expect(error).to.be.null()
        body = JSON.parse(body)
        expect(body.requesterInformation.receivedParams.action).to.equal('user')
        expect(body.requesterInformation.receivedParams.userID).to.equal('1234')
        done()
      })
    })

    it('Routes should be mapped for POST', (done) => {
      request.post(url + '/api/user/1234?key=value', (error, response, body) => {
        expect(error).to.be.null()
        body = JSON.parse(body)
        expect(body.requesterInformation.receivedParams.action).to.equal('user')
        expect(body.requesterInformation.receivedParams.userID).to.equal('1234')
        expect(body.requesterInformation.receivedParams.key).to.equal('value')
        done()
      })
    })

    it('Routes should be mapped for PUT', (done) => {
      request.put(url + '/api/user/1234?key=value', (error, response, body) => {
        expect(error).to.be.null()
        body = JSON.parse(body)
        expect(body.requesterInformation.receivedParams.action).to.equal('user')
        expect(body.requesterInformation.receivedParams.userID).to.equal('1234')
        expect(body.requesterInformation.receivedParams.key).to.equal('value')
        done()
      })
    })

    it('Routes should be mapped for DELETE', (done) => {
      request.del(url + '/api/user/1234?key=value', (error, response, body) => {
        expect(error).to.be.null()
        body = JSON.parse(body)
        expect(body.requesterInformation.receivedParams.action).to.equal('user')
        expect(body.requesterInformation.receivedParams.userID).to.equal('1234')
        expect(body.requesterInformation.receivedParams.key).to.equal('value')
        done()
      })
    })

    it('route params trump explicit params', (done) => {
      request.get(url + '/api/user/1?userID=2', (error, response, body) => {
        expect(error).to.be.null()
        body = JSON.parse(body)
        expect(body.requesterInformation.receivedParams.action).to.equal('user')
        expect(body.requesterInformation.receivedParams.userID).to.equal('1')
        done()
      })
    })

    it('to match, a route much match all parts of the URL', (done) => {
      request.get(url + '/api/thing', (error, response, body) => {
        expect(error).to.be.null()
        body = JSON.parse(body)
        expect(body.requesterInformation.receivedParams.action).to.equal('thing')

        request.get(url + '/api/thing/stuff', (error, response, body) => {
          expect(error).to.be.null()
          body = JSON.parse(body)
          expect(body.requesterInformation.receivedParams.action).to.equal('thingStuff')
          done()
        })
      })
    })

    it('regexp matches will provide proper variables', (done) => {
      request.post(url + '/api/login/123', (error, response, body) => {
        expect(error).to.be.null()
        body = JSON.parse(body)
        expect(body.requesterInformation.receivedParams.action).to.equal('login')
        expect(body.requesterInformation.receivedParams.userID).to.equal('123')

        request.post(url + '/api/login/admin', (error, response, body) => {
          expect(error).to.be.null()
          body = JSON.parse(body)
          expect(body.requesterInformation.receivedParams.action).to.equal('login')
          expect(body.requesterInformation.receivedParams.userID).to.equal('admin')
          done()
        })
      })
    })

    it('regexp matches will still work with params with periods and other wacky chars', (done) => {
      request.get(url + '/api/c/key/log_me-in.com$123.jpg', (error, response, body) => {
        expect(error).to.be.null()
        body = JSON.parse(body)
        expect(body.requesterInformation.receivedParams.action).to.equal('cacheTest')
        expect(body.requesterInformation.receivedParams.value).to.equal('log_me-in.com$123.jpg')
        done()
      })
    })

    it('regexp match failures will be rejected', (done) => {
      request.post(url + '/api/login/1234', (error, response, body) => {
        expect(error).to.be.null()
        body = JSON.parse(body)
        expect(body.error).to.equal('unknown action or invalid apiVersion')
        expect(body.requesterInformation.receivedParams.userID).to.not.exist()
        done()
      })
    })

    describe('file extensions + routes', () => {
      it('will change header information based on extension (when active)', (done) => {
        request.get(url + '/api/mimeTestAction/val.png', (error, response) => {
          expect(error).to.be.null()
          expect(response.headers['content-type']).to.equal('image/png')
          done()
        })
      })

      it('will not change header information if there is a connection.error', (done) => {
        request.get(url + '/api/mimeTestAction', (error, response, body) => {
          expect(error).to.be.null()
          body = JSON.parse(body)
          expect(response.headers['content-type']).to.equal('application/json; charset=utf-8')
          expect(body.error).to.equal('key is a required parameter for this action')
          done()
        })
      })

      it('works with with matchTrailingPathParts', (done) => {
        request.get(url + '/api/a/wild/theKey/and/some/more/path', (error, response, body) => {
          expect(error).to.be.null()
          body = JSON.parse(body)
          expect(body.requesterInformation.receivedParams.action).to.equal('mimeTestAction')
          expect(body.requesterInformation.receivedParams.path).to.equal('and/some/more/path')
          expect(body.requesterInformation.receivedParams.key).to.equal('theKey')
          done()
        })
      })
    })

    describe('spaces in URL with public files', () => {
      var source = path.join(__dirname, '/../../public/logo/actionhero.png')

      before((done) => {
        var tmpDir = os.tmpdir()
        var readStream = fs.createReadStream(source)
        readStream.pipe(fs.createWriteStream(tmpDir + path.sep + 'actionhero with space.png'))
        api.staticFile.searchLoactions.push(tmpDir)
        readStream.on('close', done)
      })

      after((done) => {
        fs.unlinkSync(os.tmpdir() + path.sep + 'actionhero with space.png')
        api.staticFile.searchLoactions.pop()
        done()
      })

      it('will decode %20 or plus sign to a space so that file system can read', (done) => {
        request.get(url + '/actionhero%20with%20space.png', (error, response) => {
          expect(error).to.be.null()
          expect(response.statusCode).to.equal(200)
          expect(response.body).to.match(/PNG/)
          expect(response.headers['content-type']).to.equal('image/png')
          done()
        })
      })

      it('will capture bad encoding in URL and return NOT FOUND', (done) => {
        request.get(url + '/actionhero%20%%%%%%%%%%with+space.png', (error, response) => {
          expect(error).to.be.null()
          expect(response.statusCode).to.equal(404)
          expect(typeof response.body).to.equal('string')
          expect(response.body).to.match(/^That file is not found/)
          done()
        })
      })
    })
  })

  describe('it should work with server custom methods', () => {
    it('actions handled by the web server support proxy for setHeaders', (done) => {
      api.actions.versions.proxyHeaders = [1]
      api.actions.actions.proxyHeaders = {
        '1': {
          name: 'proxyHeaders',
          description: 'proxy test',
          inputs: {},
          outputExample: {},
          run: (api, data, next) => {
            try {
              data.connection.setHeader('X-Foo', 'bar')
              next()
            } catch (error) {
              next(error)
            }
          }
        }
      }

      api.routes.loadRoutes({
        get: [
          {path: '/proxy', action: 'proxyHeaders', apiVersion: 1}
        ]
      })

      request.get(url + '/api/proxy', (error, response, body) => {
        expect(error).to.be.null()
        expect(response.headers['x-foo']).to.exist.and.be.equal('bar')

        api.routes.routes = {}
        delete api.actions.versions.proxyHeaders
        delete api.actions.actions.proxyHeaders

        done()
      })
    })
  })
})
