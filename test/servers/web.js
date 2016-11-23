'use strict'

var request = require('request')
var fs = require('fs')
var os = require('os')
var should = require('should')
let path = require('path')
var ActionheroPrototype = require(path.join(__dirname, '/../../actionhero.js'))
var actionhero = new ActionheroPrototype()
var api
var url

describe('Server: Web', function () {
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

  it('file: 404 pages from POST with if-modified-since header', function (done) {
    var file = Math.random().toString(36)
    var options = {
      url: url + '/' + file,
      headers: {
        'if-modified-since': 'Thu, 19 Apr 2012 09:51:20 GMT'
      }
    }

    request.get(options, function (error, response, body) {
      should.not.exist(error)
      response.statusCode.should.equal(404)
      response.body.should.equal('That file is not found')
      done()
    })
  })

  it('Server should be up and return data', function (done) {
    request.get(url + '/api/', function (error, response, body) {
      should.not.exist(error)
      body = JSON.parse(body)
      body.should.be.an.instanceOf(Object)
      done()
    })
  })

  it('Server basic response should be JSON and have basic data', function (done) {
    request.get(url + '/api/', function (error, response, body) {
      should.not.exist(error)
      body = JSON.parse(body)
      body.should.be.an.instanceOf(Object)
      body.requesterInformation.should.be.an.instanceOf(Object)
      done()
    })
  })

  it('params work', function (done) {
    request.get(url + '/api?key=value', function (error, response, body) {
      should.not.exist(error)
      body = JSON.parse(body)
      body.requesterInformation.receivedParams.key.should.equal('value')
      done()
    })
  })

  it('params are ignored unless they are in the whitelist', function (done) {
    request.get(url + '/api?crazyParam123=something', function (error, response, body) {
      should.not.exist(error)
      body = JSON.parse(body)
      should.not.exist(body.requesterInformation.receivedParams.crazyParam123)
      done()
    })
  })

  describe('will properly destroy connections', function () {
    it('works for the API', function (done) {
      Object.keys(api.connections.connections).length.should.equal(0)
      request.get(url + '/api/sleepTest', function (error) {
        should.not.exist(error)
        Object.keys(api.connections.connections).length.should.equal(0)
        setTimeout(done, 100)
      })

      setTimeout(function () {
        Object.keys(api.connections.connections).length.should.equal(1)
      }, 100)
    })

    it('works for files', function (done) {
      Object.keys(api.connections.connections).length.should.equal(0)
      request.get(url + '/simple.html', function (error) {
        should.not.exist(error)
        setTimeout(function () {
          Object.keys(api.connections.connections).length.should.equal(0)
          done()
        }, 100)
      })
    })
  })

  describe('errors', function () {
    before(function (done) {
      api.actions.versions.stringErrorTestAction = [1]
      api.actions.actions.stringErrorTestAction = {
        '1': {
          name: 'stringErrorTestAction',
          description: 'stringErrorTestAction',
          version: 1,
          run: function (api, data, next) {
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
          run: function (api, data, next) {
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
          run: function (api, data, next) {
            next({error: 'broken', reason: 'stuff'})
          }
        }
      }

      api.routes.loadRoutes()
      done()
    })

    after(function (done) {
      delete api.actions.actions.stringErrorTestAction
      delete api.actions.versions.stringErrorTestAction
      delete api.actions.actions.errorErrorTestAction
      delete api.actions.versions.errorErrorTestAction
      delete api.actions.actions.complexErrorTestAction
      delete api.actions.versions.complexErrorTestAction
      done()
    })

    it('errors can be error strings', function (done) {
      request.get(url + '/api/stringErrorTestAction/', function (error, response, body) {
        should.not.exist(error)
        body = JSON.parse(body)
        body.error.should.equal('broken')
        done()
      })
    })

    it('errors can be error objects and returned plainly', function (done) {
      request.get(url + '/api/errorErrorTestAction/', function (error, response, body) {
        should.not.exist(error)
        body = JSON.parse(body)
        body.error.should.equal('broken')
        done()
      })
    })

    it('errors can be complex JSON payloads', function (done) {
      request.get(url + '/api/complexErrorTestAction/', function (error, response, body) {
        should.not.exist(error)
        body = JSON.parse(body)
        body.error.error.should.equal('broken')
        body.error.reason.should.equal('stuff')
        done()
      })
    })
  })

  describe('if disableParamScrubbing is set ', function () {
    var orig

    before(function (done) {
      orig = api.config.general.disableParamScrubbing
      api.config.general.disableParamScrubbing = true
      done()
    })

    after(function (done) {
      api.config.general.disableParamScrubbing = orig
      done()
    })

    it('params are not ignored', function (done) {
      request.get(url + '/api/testAction/?crazyParam123=something', function (error, response, body) {
        should.not.exist(error)
        body = JSON.parse(body)
        body.requesterInformation.receivedParams.crazyParam123.should.equal('something')
        done()
      })
    })
  })

  describe('JSONp', function () {
    before(function () { api.config.servers.web.metadataOptions.requesterInformation = false })
    after(function () { api.config.servers.web.metadataOptions.requesterInformation = true })

    it('can ask for JSONp responses', function (done) {
      request.get(url + '/api/randomNumber?callback=myCallback', function (error, response, body) {
        should.not.exist(error)
        body.indexOf('myCallback({').should.equal(0)
        done()
      })
    })

    it('JSONp responses cannot be used for XSS', function (done) {
      request.get(url + '/api/randomNumber?callback=alert(%27hi%27);foo', function (error, response, body) {
        should.not.exist(error)
        body.should.not.containEql('alert(')
        body.indexOf('alert&#39;hi&#39;;foo(').should.equal(0)
        done()
      })
    })
  })

  describe('request redirecton (allowedRequestHosts)', function () {
    before(function () { api.config.servers.web.allowedRequestHosts = ['https://www.site.com'] })
    after(function () { api.config.servers.web.allowedRequestHosts = [] })

    it('will redirect clients if they do not request the proper host', function (done) {
      request.get({
        followRedirect: false,
        url: url + '/api/randomNumber',
        headers: {'Host': 'lalala.site.com'}
      }, function (error, response, body) {
        should.not.exist(error)
        response.headers.location.should.equal('https://www.site.com/api/randomNumber')
        body.should.containEql('You are being redirected to https://www.site.com/api/randomNumber')
        done()
      })
    })

    it('will allow API access from the proper hosts', function (done) {
      request.get({
        followRedirect: false,
        url: url + '/api/randomNumber',
        headers: {
          'Host': 'www.site.com',
          'x-forwarded-proto': 'https'
        }
      }, function (error, response, body) {
        should.not.exist(error)
        should.not.exist(response.headers.location)
        body.should.containEql('randomNumber')
        done()
      })
    })
  })

  it('gibberish actions have the right response', function (done) {
    request.get(url + '/api/IAMNOTANACTION', function (error, response, body) {
      should.not.exist(error)
      body = JSON.parse(body)
      body.error.should.equal('unknown action or invalid apiVersion')
      done()
    })
  })

  it('real actions do not have an error response', function (done) {
    request.get(url + '/api/status', function (error, response, body) {
      should.not.exist(error)
      body = JSON.parse(body)
      should.not.exist(body.error)
      done()
    })
  })

  it('HTTP Verbs should work: GET', function (done) {
    request.get(url + '/api/randomNumber', function (error, response, body) {
      should.not.exist(error)
      body = JSON.parse(body)
      body.randomNumber.should.be.within(0, 1)
      done()
    })
  })

  it('HTTP Verbs should work: PUT', function (done) {
    request.put(url + '/api/randomNumber', function (error, response, body) {
      should.not.exist(error)
      body = JSON.parse(body)
      body.randomNumber.should.be.within(0, 10)
      done()
    })
  })

  it('HTTP Verbs should work: POST', function (done) {
    request.post(url + '/api/randomNumber', function (error, response, body) {
      should.not.exist(error)
      body = JSON.parse(body)
      body.randomNumber.should.be.within(0, 100)
      done()
    })
  })

  it('HTTP Verbs should work: DELETE', function (done) {
    request.del(url + '/api/randomNumber', function (error, response, body) {
      should.not.exist(error)
      body = JSON.parse(body)
      body.randomNumber.should.be.within(0, 1000)
      done()
    })
  })

  it('HTTP Verbs should work: Post with Form', function (done) {
    request.post(url + '/api/cacheTest', {form: {key: 'key', value: 'value'}}, function (error, response, body) {
      should.not.exist(error)
      body = JSON.parse(body)
      body.cacheTestResults.saveResp.should.eql(true)
      done()
    })
  })

  it('HTTP Verbs should work: Post with JSON Payload as body', function (done) {
    var body = JSON.stringify({key: 'key', value: 'value'})
    request.post(url + '/api/cacheTest', {'body': body, 'headers': {'Content-type': 'application/json'}}, function (error, response, body) {
      should.not.exist(error)
      body = JSON.parse(body)
      body.cacheTestResults.saveResp.should.eql(true)
      done()
    })
  })

  describe('connection.rawConnection.params', function () {
    before(function (done) {
      api.actions.versions.paramTestAction = [1]
      api.actions.actions.paramTestAction = {
        '1': {
          name: 'paramTestAction',
          description: 'I return connection.rawConnection.params',
          version: 1,
          run: function (api, data, next) {
            data.response = data.connection.rawConnection.params
            next()
          }
        }
      }

      api.routes.loadRoutes()
      done()
    })

    after(function (done) {
      delete api.actions.actions.paramTestAction
      delete api.actions.versions.paramTestAction
      done()
    })

    it('.query should contain unfiltered query params', function (done) {
      request.get(url + '/api/paramTestAction/?crazyParam123=something', function (error, response, body) {
        should.not.exist(error)
        body = JSON.parse(body)
        body.query.crazyParam123.should.equal('something')
        done()
      })
    })

    it('.body should contain unfiltered request body params', function (done) {
      var requestBody = JSON.stringify({key: 'value'})
      request.post(url + '/api/paramTestAction', {'body': requestBody, 'headers': {'Content-type': 'application/json'}}, function (error, response, body) {
        should.not.exist(error)
        body = JSON.parse(body)
        body.body.key.should.eql('value')
        done()
      })
    })
  })

  it('returnErrorCodes false should still have a status of 200', function (done) {
    api.config.servers.web.returnErrorCodes = false
    request.del(url + '/api/', function (error, response, body) {
      should.not.exist(error)
      body = JSON.parse(body)
      response.statusCode.should.eql(200)
      done()
    })
  })

  it('returnErrorCodes can be opted to change http header codes', function (done) {
    api.config.servers.web.returnErrorCodes = true
    request.del(url + '/api/', function (error, response, body) {
      should.not.exist(error)
      body = JSON.parse(body)
      response.statusCode.should.eql(404)
      done()
    })
  })

  describe('http header', function () {
    before(function (done) {
      api.config.servers.web.returnErrorCodes = true
      api.actions.versions.headerTestAction = [1]
      api.actions.actions.headerTestAction = {
        '1': {
          name: 'headerTestAction',
          description: 'I am a test',
          version: 1,
          outputExample: {},
          run: function (api, data, next) {
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

    after(function (done) {
      delete api.actions.actions.headerTestAction
      delete api.actions.versions.headerTestAction
      done()
    })

    it('duplicate headers should be removed (in favor of the last set)', function (done) {
      request.get(url + '/api/headerTestAction', function (error, response, body) {
        should.not.exist(error)
        body = JSON.parse(body)
        response.statusCode.should.eql(200)
        response.headers.thing.should.eql('C')
        done()
      })
    })

    it('but duplicate set-cookie requests should be allowed', function (done) {
      request.get(url + '/api/headerTestAction', function (error, response, body) {
        should.not.exist(error)
        body = JSON.parse(body)
        response.statusCode.should.eql(200)
        response.headers['set-cookie'].length.should.eql(3) // 2 + session
        response.headers['set-cookie'][1].should.eql('value_1=1')
        response.headers['set-cookie'][0].should.eql('value_2=2')
        done()
      })
    })

    it('should respond to OPTIONS with only HTTP headers', function (done) {
      request({method: 'options', url: url + '/api/cacheTest'}, function (error, response) {
        should.not.exist(error)
        response.statusCode.should.eql(200)
        response.headers['access-control-allow-methods'].should.equal('HEAD, GET, POST, PUT, PATCH, DELETE, OPTIONS, TRACE')
        response.headers['access-control-allow-origin'].should.equal('*')
        response.headers['content-length'].should.equal('0')
        done()
      })
    })

    it('should respond to TRACE with parsed params received', function (done) {
      request({method: 'trace', url: url + '/api/x', form: {key: 'someKey', value: 'someValue'}}, function (error, response, body) {
        should.not.exist(error)
        body = JSON.parse(body)
        response.statusCode.should.eql(200)
        body.receivedParams.key.should.equal('someKey')
        body.receivedParams.value.should.equal('someValue')
        done()
      })
    })

    it('should respond to HEAD requests just like GET, but with no body', function (done) {
      request({method: 'head', url: url + '/api/headerTestAction'}, function (error, response, body) {
        should.not.exist(error)
        response.statusCode.should.eql(200)
        body.should.equal('')
        done()
      })
    })

    it('keeps sessions with browser_fingerprint', function (done) {
      var j = request.jar()
      request.post({url: url + '/api', jar: j}, function (error, response1, body1) {
        should.not.exist(error)
        request.get({url: url + '/api', jar: j}, function (error, response2, body2) {
          should.not.exist(error)
          request.put({url: url + '/api', jar: j}, function (error, response3, body3) {
            should.not.exist(error)
            request.del({url: url + '/api', jar: j}, function (error, response4, body4) {
              should.not.exist(error)

              body1 = JSON.parse(body1)
              body2 = JSON.parse(body2)
              body3 = JSON.parse(body3)
              body4 = JSON.parse(body4)

              response1.headers['set-cookie'].should.exist
              should.not.exist(response2.headers['set-cookie'])
              should.not.exist(response3.headers['set-cookie'])
              should.not.exist(response4.headers['set-cookie'])

              var fingerprint1 = body1.requesterInformation.id.split('-')[0]
              var fingerprint2 = body2.requesterInformation.id.split('-')[0]
              var fingerprint3 = body3.requesterInformation.id.split('-')[0]
              var fingerprint4 = body4.requesterInformation.id.split('-')[0]

              fingerprint1.should.equal(fingerprint2)
              fingerprint1.should.equal(fingerprint3)
              fingerprint1.should.equal(fingerprint4)

              fingerprint1.should.equal(body1.requesterInformation.fingerprint)
              fingerprint2.should.equal(body2.requesterInformation.fingerprint)
              fingerprint3.should.equal(body3.requesterInformation.fingerprint)
              fingerprint4.should.equal(body4.requesterInformation.fingerprint)
              done()
            })
          })
        })
      })
    })
  })

  describe('http returnErrorCodes true', function () {
    before(function (done) {
      api.config.servers.web.returnErrorCodes = true

      api.actions.versions.statusTestAction = [1]
      api.actions.actions.statusTestAction = {
        '1': {
          name: 'statusTestAction',
          description: 'I am a test',
          inputs: {
            key: {required: true}
          },
          run: function (api, data, next) {
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

    after(function (done) {
      api.config.servers.web.returnErrorCodes = false
      delete api.actions.versions.statusTestAction
      delete api.actions.actions.statusTestAction
      done()
    })

    it('actions that do not exists should return 404', function (done) {
      request.post(url + '/api/aFakeAction', function (error, response, body) {
        should.not.exist(error)
        body = JSON.parse(body)
        response.statusCode.should.eql(404)
        done()
      })
    })

    it('missing params result in a 422', function (done) {
      request.post(url + '/api/statusTestAction', function (error, response, body) {
        should.not.exist(error)
        body = JSON.parse(body)
        response.statusCode.should.eql(422)
        done()
      })
    })

    it('status codes can be set for errors', function (done) {
      request.post(url + '/api/statusTestAction', {form: {key: 'bannana'}}, function (error, response, body) {
        should.not.exist(error)
        body = JSON.parse(body)
        body.error.should.eql('key != value')
        response.statusCode.should.eql(402)
        done()
      })
    })

    it('status code should still be 200 if everything is OK', function (done) {
      request.post(url + '/api/statusTestAction', {form: {key: 'value'}}, function (error, response, body) {
        should.not.exist(error)
        body = JSON.parse(body)
        body.good.should.eql(true)
        response.statusCode.should.eql(200)
        done()
      })
    })
  })

  describe('documentation', function () {
    it('documentation can be returned via a documentation action', function (done) {
      request.get(url + '/api/showDocumentation', function (error, response, body) {
        should.not.exist(error)
        body = JSON.parse(body)
        body.documentation.should.be.an.instanceOf(Object)
        done()
      })
    })

    it('should have actions with all the right parts', function (done) {
      request.get(url + '/api/showDocumentation', function (error, response, body) {
        should.not.exist(error)
        body = JSON.parse(body)
        for (var actionName in body.documentation) {
          for (var version in body.documentation[actionName]) {
            var action = body.documentation[actionName][version]
            action.name.should.be.a.String
            action.description.should.be.a.String
            action.inputs.should.be.an.instanceOf(Object)
          }
        }
        done()
      })
    })
  })

  describe('files', function () {
    it('file: an HTML file', function (done) {
      request.get(url + '/public/simple.html', function (error, response) {
        should.not.exist(error)
        response.statusCode.should.equal(200)
        response.body.should.equal('<h1>ActionHero</h1>\\nI am a flat file being served to you via the API from ./public/simple.html<br />')
        done()
      })
    })

    it('file: 404 pages', function (done) {
      request.get(url + '/public/notARealFile', function (error, response) {
        should.not.exist(error)
        response.statusCode.should.equal(404)
        response.body.should.not.containEql('notARealFile')
        done()
      })
    })

    it('I should not see files outside of the public dir', function (done) {
      request.get(url + '/public/../config.json', function (error, response) {
        should.not.exist(error)
        response.statusCode.should.equal(404)
        response.body.should.equal('That file is not found')
        done()
      })
    })

    it('file: index page should be served when requesting a path (trailing slash)', function (done) {
      request.get(url + '/public/', function (error, response) {
        should.not.exist(error)
        response.statusCode.should.equal(200)
        response.body.should.be.a.String
        done()
      })
    })

    it('file: index page should be served when requesting a path (no trailing slash)', function (done) {
      request.get(url + '/public', function (error, response) {
        should.not.exist(error)
        response.statusCode.should.equal(200)
        response.body.should.be.a.String
        done()
      })
    })

    describe('can serve files from a specific mapped route', function () {
      before(function (done) {
        var testFolderPublicPath = path.join(__dirname, '/../../public/testFolder')
        fs.mkdirSync(testFolderPublicPath)
        fs.writeFileSync(testFolderPublicPath + '/testFile.html', 'ActionHero Route Test File')
        api.routes.registerRoute('get', '/my/public/route', null, null, true, testFolderPublicPath)
        process.nextTick(function () {
          done()
        })
      })

      after(function (done) {
        var testFolderPublicPath = path.join(__dirname, '/../../public/testFolder')
        fs.unlinkSync(testFolderPublicPath + path.sep + 'testFile.html')
        fs.rmdirSync(testFolderPublicPath)
        process.nextTick(function () {
          done()
        })
      })

      it('works for routes mapped paths', function (done) {
        request.get(url + '/my/public/route/testFile.html', function (error, response) {
          should.not.exist(error)
          response.statusCode.should.equal(200)
          response.body.should.equal('ActionHero Route Test File')
          done()
        })
      })

      it('returns 404 for files not available in route mapped paths', function (done) {
        request.get(url + '/my/public/route/fileNotFound.html', function (error, response) {
          should.not.exist(error)
          response.statusCode.should.equal(404)
          done()
        })
      })

      it('I should not see files outside of the mapped dir', function (done) {
        request.get(url + '/my/public/route/../../config/servers/web.js', function (error, response) {
          should.not.exist(error)
          response.statusCode.should.equal(404)
          done()
        })
      })
    })

    describe('can serve files from more than one directory', function () {
      var source = path.join(__dirname, '/../../public/simple.html')

      before(function (done) {
        fs.createReadStream(source).pipe(fs.createWriteStream(os.tmpdir() + path.sep + 'testFile.html'))
        api.staticFile.searchLoactions.push(os.tmpdir())
        process.nextTick(function () {
          done()
        })
      })

      after(function (done) {
        fs.unlink(os.tmpdir() + path.sep + 'testFile.html')
        api.staticFile.searchLoactions.pop()
        process.nextTick(function () {
          done()
        })
      })

      it('works for secondary paths', function (done) {
        request.get(url + '/public/testFile.html', function (error, response) {
          should.not.exist(error)
          response.statusCode.should.equal(200)
          response.body.should.equal('<h1>ActionHero</h1>\\nI am a flat file being served to you via the API from ./public/simple.html<br />')
          done()
        })
      })
    })

    describe('depth routes', function () {
      before(function () {
        api.config.servers.web.urlPathForActions = '/craz/y/action/path'
        api.config.servers.web.urlPathForFiles = '/a/b/c'
      })

      after(function () {
        api.config.servers.web.urlPathForActions = 'api'
        api.config.servers.web.urlPathForFiles = 'public'
      })

      it('old action routes stop working', function (done) {
        request.get(url + '/api/randomNumber', function (error, response) {
          should.not.exist(error)
          response.statusCode.should.equal(404)
          done()
        })
      })

      it('can ask for nested URL actions', function (done) {
        request.get(url + '/craz/y/action/path/randomNumber', function (error, response) {
          should.not.exist(error)
          response.statusCode.should.equal(200)
          done()
        })
      })

      it('old file routes stop working', function (done) {
        request.get(url + '/public/simple.html', function (error, response) {
          should.not.exist(error)
          response.statusCode.should.equal(404)
          done()
        })
      })

      it('can ask for nested URL files', function (done) {
        request.get(url + '/a/b/c/simple.html', function (error, response) {
          should.not.exist(error)
          response.statusCode.should.equal(200)
          response.body.should.equal('<h1>ActionHero</h1>\\nI am a flat file being served to you via the API from ./public/simple.html<br />')
          done()
        })
      })

      it('can ask for nested URL files with depth', function (done) {
        request.get(url + '/a/b/c/css/cosmo.css', function (error, response) {
          should.not.exist(error)
          response.statusCode.should.equal(200)
          done()
        })
      })
    })
  })

  describe('routes', function () {
    before(function (done) {
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
          run: function (api, data, next) {
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
          run: function (api, data, next) {
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
          run: function (api, data, next) {
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

    after(function (done) {
      api.routes.routes = {}
      delete api.actions.versions.mimeTestAction
      delete api.actions.actions.mimeTestAction
      delete api.actions.versions.login
      delete api.actions.actions.login
      done()
    })

    it('new params will not be allowed in route definitions (an action should do it)', function (done) {
      (api.params.postVariables.indexOf('bogusID') < 0).should.equal(true)
      done()
    })

    it('\'all\' routes are duplicated properly', function (done) {
      ['get', 'post', 'put', 'delete'].forEach(function (verb) {
        api.routes.routes[verb][0].action.should.equal('user')
        api.routes.routes[verb][0].path.should.equal('/user/:userID')
      })
      done()
    })

    it('unknown actions are still unknown', function (done) {
      request.get(url + '/api/a_crazy_action', function (error, response, body) {
        should.not.exist(error)
        body = JSON.parse(body)
        body.error.should.equal('unknown action or invalid apiVersion')
        done()
      })
    })

    it('explicit action declarations still override routed actions, if the defined action is real', function (done) {
      request.get(url + '/api/user/123?action=randomNumber', function (error, response, body) {
        should.not.exist(error)
        body = JSON.parse(body)
        body.requesterInformation.receivedParams.action.should.equal('randomNumber')
        done()
      })
    })

    it('route actions will override explicit actions, if the defined action is null', function (done) {
      request.get(url + '/api/user/123?action=someFakeAction', function (error, response, body) {
        should.not.exist(error)
        body = JSON.parse(body)
        body.requesterInformation.receivedParams.action.should.equal('user')
        done()
      })
    })

    it('route actions have the matched route availalbe to the action', function (done) {
      request.get(url + '/api/mimeTestAction/thing.json', function (error, response, body) {
        should.not.exist(error)
        body = JSON.parse(body)
        body.matchedRoute.path.should.equal('/mimeTestAction/:key')
        body.matchedRoute.action.should.equal('mimeTestAction')
        done()
      })
    })

    it('Routes should recognize apiVersion as default param', function (done) {
      request.get(url + '/api/old_login?user_id=7', function (error, response, body) {
        should.not.exist(error)
        body = JSON.parse(body)
        body.user_id.should.equal('7')
        body.requesterInformation.receivedParams.action.should.equal('login')
        done()
      })
    })

    it('Routes should be mapped for GET (simple)', function (done) {
      request.get(url + '/api/users', function (error, response, body) {
        should.not.exist(error)
        body = JSON.parse(body)
        body.requesterInformation.receivedParams.action.should.equal('usersList')
        done()
      })
    })

    it('Routes should be mapped for GET (complex)', function (done) {
      request.get(url + '/api/user/1234', function (error, response, body) {
        should.not.exist(error)
        body = JSON.parse(body)
        body.requesterInformation.receivedParams.action.should.equal('user')
        body.requesterInformation.receivedParams.userID.should.equal('1234')
        done()
      })
    })

    it('Routes should be mapped for POST', function (done) {
      request.post(url + '/api/user/1234?key=value', function (error, response, body) {
        should.not.exist(error)
        body = JSON.parse(body)
        body.requesterInformation.receivedParams.action.should.equal('user')
        body.requesterInformation.receivedParams.userID.should.equal('1234')
        body.requesterInformation.receivedParams.key.should.equal('value')
        done()
      })
    })

    it('Routes should be mapped for PUT', function (done) {
      request.put(url + '/api/user/1234?key=value', function (error, response, body) {
        should.not.exist(error)
        body = JSON.parse(body)
        body.requesterInformation.receivedParams.action.should.equal('user')
        body.requesterInformation.receivedParams.userID.should.equal('1234')
        body.requesterInformation.receivedParams.key.should.equal('value')
        done()
      })
    })

    it('Routes should be mapped for DELETE', function (done) {
      request.del(url + '/api/user/1234?key=value', function (error, response, body) {
        should.not.exist(error)
        body = JSON.parse(body)
        body.requesterInformation.receivedParams.action.should.equal('user')
        body.requesterInformation.receivedParams.userID.should.equal('1234')
        body.requesterInformation.receivedParams.key.should.equal('value')
        done()
      })
    })

    it('route params trump explicit params', function (done) {
      request.get(url + '/api/user/1?userID=2', function (error, response, body) {
        should.not.exist(error)
        body = JSON.parse(body)
        body.requesterInformation.receivedParams.action.should.equal('user')
        body.requesterInformation.receivedParams.userID.should.equal('1')
        done()
      })
    })

    it('to match, a route much match all parts of the URL', function (done) {
      request.get(url + '/api/thing', function (error, response, body) {
        should.not.exist(error)
        body = JSON.parse(body)
        body.requesterInformation.receivedParams.action.should.equal('thing')

        request.get(url + '/api/thing/stuff', function (error, response, body) {
          should.not.exist(error)
          body = JSON.parse(body)
          body.requesterInformation.receivedParams.action.should.equal('thingStuff')
          done()
        })
      })
    })

    it('regexp matches will provide proper variables', function (done) {
      request.post(url + '/api/login/123', function (error, response, body) {
        should.not.exist(error)
        body = JSON.parse(body)
        body.requesterInformation.receivedParams.action.should.equal('login')
        body.requesterInformation.receivedParams.userID.should.equal('123')

        request.post(url + '/api/login/admin', function (error, response, body) {
          should.not.exist(error)
          body = JSON.parse(body)
          body.requesterInformation.receivedParams.action.should.equal('login')
          body.requesterInformation.receivedParams.userID.should.equal('admin')
          done()
        })
      })
    })

    it('regexp matches will still work with params with periods and other wacky chars', function (done) {
      request.get(url + '/api/c/key/log_me-in.com$123.jpg', function (error, response, body) {
        should.not.exist(error)
        body = JSON.parse(body)
        body.requesterInformation.receivedParams.action.should.equal('cacheTest')
        body.requesterInformation.receivedParams.value.should.equal('log_me-in.com$123.jpg')
        done()
      })
    })

    it('regexp match failures will be rejected', function (done) {
      request.post(url + '/api/login/1234', function (error, response, body) {
        should.not.exist(error)
        body = JSON.parse(body)
        body.error.should.equal('unknown action or invalid apiVersion')
        should.not.exist(body.requesterInformation.receivedParams.userID)
        done()
      })
    })

    describe('file extensions + routes', function () {
      it('will change header information based on extension (when active)', function (done) {
        request.get(url + '/api/mimeTestAction/val.png', function (error, response) {
          should.not.exist(error)
          response.headers['content-type'].should.equal('image/png')
          done()
        })
      })

      it('will not change header information if there is a connection.error', function (done) {
        request.get(url + '/api/mimeTestAction', function (error, response, body) {
          should.not.exist(error)
          body = JSON.parse(body)
          response.headers['content-type'].should.equal('application/json; charset=utf-8')
          body.error.should.equal('key is a required parameter for this action')
          done()
        })
      })

      it('works with with matchTrailingPathParts', function (done) {
        request.get(url + '/api/a/wild/theKey/and/some/more/path', function (error, response, body) {
          should.not.exist(error)
          body = JSON.parse(body)
          body.requesterInformation.receivedParams.action.should.equal('mimeTestAction')
          body.requesterInformation.receivedParams.path.should.equal('and/some/more/path')
          body.requesterInformation.receivedParams.key.should.equal('theKey')
          done()
        })
      })
    })

    describe('spaces in URL with public files', function () {
      var source = path.join(__dirname, '/../../public/logo/actionhero.png')

      before(function (done) {
        var tmpDir = os.tmpdir()
        var readStream = fs.createReadStream(source)
        readStream.pipe(fs.createWriteStream(tmpDir + path.sep + 'actionhero with space.png'))
        api.staticFile.searchLoactions.push(tmpDir)
        readStream.on('close', done)
      })

      after(function (done) {
        fs.unlinkSync(os.tmpdir() + path.sep + 'actionhero with space.png')
        api.staticFile.searchLoactions.pop()
        done()
      })

      it('will decode %20 or plus sign to a space so that file system can read', function (done) {
        request.get(url + '/actionhero%20with%20space.png', function (error, response) {
          should.not.exist(error)
          response.statusCode.should.equal(200)
          response.body.should.be.an.instanceOf(Object)
          response.headers['content-type'].should.equal('image/png')
          done()
        })
      })

      it('will capture bad encoding in URL and return NOT FOUND', function (done) {
        request.get(url + '/actionhero%20%%%%%%%%%%with+space.png', function (error, response) {
          should.not.exist(error)
          response.statusCode.should.equal(404)
          response.body.should.be.an.instanceOf(String)
          response.body.should.startWith('That file is not found')
          done()
        })
      })
    })
  })
})
