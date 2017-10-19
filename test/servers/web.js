'use strict'

const chai = require('chai')
const dirtyChai = require('dirty-chai')
const expect = chai.expect
chai.use(dirtyChai)

const request = require('request-promise-native')
const fs = require('fs')
const os = require('os')
const path = require('path')
const {promisify} = require('util')
const ActionHero = require(path.join(__dirname, '/../../index.js'))
const actionhero = new ActionHero.Process()
let api
let url

const sleep = async (timeout) => { await promisify(setTimeout)(timeout) }

const toJson = async (string) => {
  try {
    return JSON.parse(string)
  } catch (error) {
    return error
  }
}

describe('Server: Web', () => {
  before(async () => {
    api = await actionhero.start()
    url = 'http://localhost:' + api.config.servers.web.port
  })

  after(async () => { await actionhero.stop() })

  it('should be up and return data', async () => {
    await request.get(url + '/api/randomNumber').then(toJson)
    // should throw no errors
  })

  it('basic response should be JSON and have basic data', async () => {
    let body = await request.get(url + '/api/randomNumber').then(toJson)
    expect(body).to.be.instanceof(Object)
    expect(body.requesterInformation).to.be.instanceof(Object)
  })

  it('returns JSON with errors', async () => {
    try {
      await request.get(url + '/api').then(toJson)
      throw new Error('should not get here')
    } catch (error) {
      expect(error.statusCode).to.equal(404)
      let body = await toJson(error.response.body)
      expect(body.requesterInformation).to.be.instanceof(Object)
    }
  })

  it('params work', async () => {
    try {
      await request.get(url + '/api?key=value').then(toJson)
      throw new Error('should not get here')
    } catch (error) {
      expect(error.statusCode).to.equal(404)
      let body = await toJson(error.response.body)
      expect(body.requesterInformation.receivedParams.key).to.equal('value')
    }
  })

  it('params are ignored unless they are in the whitelist', async () => {
    try {
      await request.get(url + '/api?crazyParam123=something').then(toJson)
      throw new Error('should not get here')
    } catch (error) {
      expect(error.statusCode).to.equal(404)
      let body = await toJson(error.response.body)
      expect(body.requesterInformation.receivedParams.crazyParam123).to.not.exist()
    }
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
          run: (data) => {
            data.toRender = false
            data.connection.rawConnection.res.writeHead(200, { 'Content-Type': 'text/plain' })
            data.connection.rawConnection.res.end(`${Math.random()}`)
          }
        }
      }

      api.routes.loadRoutes()
    })

    after(() => {
      delete api.actions.actions.customRender
      delete api.actions.versions.customRender
    })

    it('works for the API', async () => {
      expect(Object.keys(api.connections.connections)).to.have.length(0)
      request.get(url + '/api/sleepTest').then(toJson) // don't await

      await sleep(100)
      expect(Object.keys(api.connections.connections)).to.have.length(1)

      await sleep(1000)
      expect(Object.keys(api.connections.connections)).to.have.length(0)
    })

    it('works for files', async () => {
      expect(Object.keys(api.connections.connections)).to.have.length(0)
      await request.get(url + '/simple.html')
      await sleep(100)
      expect(Object.keys(api.connections.connections)).to.have.length(0)
    })

    it('works for actions with toRender: false', async () => {
      expect(Object.keys(api.connections.connections)).to.have.length(0)
      let body = await request.get(url + '/api/customRender').then(toJson)
      expect(body).to.exist()
      await sleep(100)
      expect(Object.keys(api.connections.connections)).to.have.length(0)
    })
  })

  describe('errors', () => {
    before(() => {
      api.actions.versions.stringErrorTestAction = [1]
      api.actions.actions.stringErrorTestAction = {
        '1': {
          name: 'stringErrorTestAction',
          description: 'stringErrorTestAction',
          version: 1,
          run: (data) => {
            data.response.error = 'broken'
          }
        }
      }

      api.actions.versions.errorErrorTestAction = [1]
      api.actions.actions.errorErrorTestAction = {
        '1': {
          name: 'errorErrorTestAction',
          description: 'errorErrorTestAction',
          version: 1,
          run: (data) => {
            throw new Error('broken')
          }
        }
      }

      api.actions.versions.complexErrorTestAction = [1]
      api.actions.actions.complexErrorTestAction = {
        '1': {
          name: 'complexErrorTestAction',
          description: 'complexErrorTestAction',
          version: 1,
          run: (data) => {
            data.response.error = {error: 'broken', reason: 'stuff'}
          }
        }
      }

      api.routes.loadRoutes()
    })

    after(() => {
      delete api.actions.actions.stringErrorTestAction
      delete api.actions.versions.stringErrorTestAction
      delete api.actions.actions.errorErrorTestAction
      delete api.actions.versions.errorErrorTestAction
      delete api.actions.actions.complexErrorTestAction
      delete api.actions.versions.complexErrorTestAction
    })

    it('errors can be error strings', async () => {
      try {
        await request.get(url + '/api/stringErrorTestAction')
        throw new Error('should not get here')
      } catch (error) {
        expect(error.statusCode).to.equal(400)
        let body = await toJson(error.response.body)
        expect(body.error).to.equal('broken')
      }
    })

    it('errors can be error objects and returned plainly', async () => {
      try {
        await request.get(url + '/api/errorErrorTestAction')
        throw new Error('should not get here')
      } catch (error) {
        expect(error.statusCode).to.equal(400)
        let body = await toJson(error.response.body)
        expect(body.error).to.equal('broken')
      }
    })

    it('errors can be complex JSON payloads', async () => {
      try {
        await request.get(url + '/api/complexErrorTestAction')
        throw new Error('should not get here')
      } catch (error) {
        expect(error.statusCode).to.equal(400)
        let body = await toJson(error.response.body)
        expect(body.error).to.deep.equal({ error: 'broken', reason: 'stuff' })
      }
    })
  })

  describe('if disableParamScrubbing is set', () => {
    let orig
    before(() => {
      orig = api.config.general.disableParamScrubbing
      api.config.general.disableParamScrubbing = true
    })

    after(() => {
      api.config.general.disableParamScrubbing = orig
    })

    it('params are not ignored', async () => {
      try {
        await request.get(url + '/api/testAction/?crazyParam123=something')
        throw new Error('should not get here')
      } catch (error) {
        expect(error.statusCode).to.equal(404)
        let body = await toJson(error.response.body)
        expect(body.requesterInformation.receivedParams.crazyParam123).to.equal('something')
      }
    })
  })

  describe('JSONp', () => {
    let orig
    before(() => {
      orig = api.config.servers.web.metadataOptions.requesterInformation
      api.config.servers.web.metadataOptions.requesterInformation = false
    })

    after(() => {
      api.config.servers.web.metadataOptions.requesterInformation = orig
    })

    it('can ask for JSONp responses', async () => {
      let response = await request.get(url + '/api/randomNumber?callback=myCallback')
      expect(response.indexOf('myCallback({')).to.equal(0)
      expect(response.indexOf('Your random number is')).to.be.above(0)
    })

    it('JSONp responses cannot be used for XSS', async () => {
      let response = await request.get(url + '/api/randomNumber?callback=alert(%27hi%27);foo')
      expect(response).not.to.match(/alert\(/)
      expect(response.indexOf('alert&#39;hi&#39;;foo(')).to.equal(0)
    })
  })

  describe('request redirecton (allowedRequestHosts)', () => {
    let orig
    before(() => {
      orig = api.config.servers.web.allowedRequestHosts
      api.config.servers.web.allowedRequestHosts = ['https://www.site.com']
    })

    after(() => { api.config.servers.web.allowedRequestHosts = orig })

    it('will redirect clients if they do not request the proper host', async () => {
      try {
        await request.get({
          followRedirect: false,
          url: url + '/api/randomNumber',
          headers: {'Host': 'lalala.site.com'}
        })
        throw new Error('should not get here')
      } catch (error) {
        expect(error.statusCode).to.equal(302)
        expect(error.response.body).to.match(/You are being redirected to https:\/\/www.site.com\/api\/randomNumber/)
      }
    })

    it('will allow API access from the proper hosts', async () => {
      let response = await request.get({
        followRedirect: false,
        url: url + '/api/randomNumber',
        headers: {
          'Host': 'www.site.com',
          'x-forwarded-proto': 'https'
        }
      })

      expect(response).to.match(/randomNumber/)
    })
  })

  it('gibberish actions have the right response', async () => {
    try {
      await request.get(url + '/api/IAMNOTANACTION')
      throw new Error('should not get here')
    } catch (error) {
      expect(error.statusCode).to.equal(404)
      let body = await toJson(error.response.body)
      expect(body.error).to.deep.equal('unknown action or invalid apiVersion')
    }
  })

  it('real actions do not have an error response', async () => {
    let body = await request.get(url + '/api/status').then(toJson)
    expect(body.error).to.not.exist()
  })

  it('HTTP Verbs should work: GET', async () => {
    let body = await request.get(url + '/api/randomNumber').then(toJson)
    expect(body.randomNumber).to.be.at.least(0)
    expect(body.randomNumber).to.be.at.most(1)
  })

  it('HTTP Verbs should work: PUT', async () => {
    let body = await request.put(url + '/api/randomNumber').then(toJson)
    expect(body.randomNumber).to.be.at.least(0)
    expect(body.randomNumber).to.be.at.most(1)
  })

  it('HTTP Verbs should work: POST', async () => {
    let body = await request.post(url + '/api/randomNumber').then(toJson)
    expect(body.randomNumber).to.be.at.least(0)
    expect(body.randomNumber).to.be.at.most(100)
  })

  it('HTTP Verbs should work: DELETE', async () => {
    let body = await request.delete(url + '/api/randomNumber').then(toJson)
    expect(body.randomNumber).to.be.at.least(0)
    expect(body.randomNumber).to.be.at.most(1000)
  })

  it('HTTP Verbs should work: Post with Form', async () => {
    try {
      await request.post(url + '/api/cacheTest', {form: {key: 'key'}})
      throw new Error('should not get here')
    } catch (error) {
      expect(error.statusCode).to.equal(422)
      expect(error.message).to.match(/value is a required parameter for this action/)
    }

    let successBody = await request.post(url + '/api/cacheTest', {form: {key: 'key', value: 'value'}}).then(toJson)
    expect(successBody.cacheTestResults.saveResp).to.equal(true)
  })

  it('HTTP Verbs should work: Post with JSON Payload as body', async () => {
    let bodyPayload = JSON.stringify({key: 'key'})
    try {
      await request.post(url + '/api/cacheTest', {'body': bodyPayload, 'headers': {'Content-type': 'application/json'}})
      throw new Error('should not get here')
    } catch (error) {
      expect(error.statusCode).to.equal(422)
      expect(error.message).to.match(/value is a required parameter for this action/)
    }

    bodyPayload = JSON.stringify({key: 'key', value: 'value'})
    let successBody = await request.post(url + '/api/cacheTest', {'body': bodyPayload, 'headers': {'Content-type': 'application/json'}}).then(toJson)
    expect(successBody.cacheTestResults.saveResp).to.equal(true)
  })

  describe('connection.rawConnection.params', () => {
    before(() => {
      api.actions.versions.paramTestAction = [1]
      api.actions.actions.paramTestAction = {
        '1': {
          name: 'paramTestAction',
          description: 'I return connection.rawConnection.params',
          version: 1,
          run: (data) => {
            data.response = data.connection.rawConnection.params
            if (data.connection.rawConnection.params.rawBody) {
              data.response.rawBody = data.connection.rawConnection.params.rawBody.toString()
            }
          }
        }
      }

      api.routes.loadRoutes()
    })

    after(() => {
      delete api.actions.actions.paramTestAction
      delete api.actions.versions.paramTestAction
    })

    it('.query should contain unfiltered query params', async () => {
      let body = await request.get(url + '/api/paramTestAction/?crazyParam123=something').then(toJson)
      expect(body.query.crazyParam123).to.equal('something')
    })

    it('.body should contain unfiltered, parsed request body params', async () => {
      let requestBody = JSON.stringify({key: 'value'})
      let body = await request.post(url + '/api/paramTestAction', {'body': requestBody, 'headers': {'Content-type': 'application/json'}}).then(toJson)
      expect(body.body.key).to.equal('value')
    })

    describe('connection.rawConnection.rawBody', () => {
      let orig
      before(() => { orig = api.config.servers.web.saveRawBody })
      after(() => { api.config.servers.web.saveRawBody = orig })

      it('.rawBody will contain the raw POST body without parsing', async () => {
        api.config.servers.web.saveRawBody = true
        let requestBody = '{"key":      "value"}'
        let body = await request.post(url + '/api/paramTestAction', {'body': requestBody, 'headers': {'Content-type': 'application/json'}}).then(toJson)
        expect(body.body.key).to.equal('value')
        expect(body.rawBody).to.equal('{"key":      "value"}')
      })

      it('.rawBody can be disabled', async () => {
        api.config.servers.web.saveRawBody = false
        let requestBody = '{"key":      "value"}'
        let body = await request.post(url + '/api/paramTestAction', {'body': requestBody, 'headers': {'Content-type': 'application/json'}}).then(toJson)
        expect(body.body.key).to.equal('value')
        expect(body.rawBody).to.equal('')
      })
    })
  })

  describe('errorCodes', () => {
    let orig
    before(() => { orig = api.config.servers.web.returnErrorCodes })
    after(() => { api.config.servers.web.returnErrorCodes = orig })

    it('returnErrorCodes false should still have a status of 200', async () => {
      api.config.servers.web.returnErrorCodes = false
      let response = await request.del(url + '/api/', {resolveWithFullResponse: true})
      expect(response.statusCode).to.equal(200)
    })

    it('returnErrorCodes can be opted to change http header codes', async () => {
      api.config.servers.web.returnErrorCodes = true
      try {
        await request.del(url + '/api/')
      } catch (error) {
        expect(error.statusCode).to.equal(404)
      }
    })
  })

  describe('http header', () => {
    before(() => {
      api.actions.versions.headerTestAction = [1]
      api.actions.actions.headerTestAction = {
        '1': {
          name: 'headerTestAction',
          description: 'I am a test',
          version: 1,
          outputExample: {},
          run: (data) => {
            data.connection.rawConnection.responseHeaders.push(['thing', 'A'])
            data.connection.rawConnection.responseHeaders.push(['thing', 'B'])
            data.connection.rawConnection.responseHeaders.push(['thing', 'C'])
            data.connection.rawConnection.responseHeaders.push(['Set-Cookie', 'value_1=1'])
            data.connection.rawConnection.responseHeaders.push(['Set-Cookie', 'value_2=2'])
          }
        }
      }

      api.routes.loadRoutes()
    })

    after(() => {
      delete api.actions.actions.headerTestAction
      delete api.actions.versions.headerTestAction
    })

    it('duplicate headers should be removed (in favor of the last set)', async () => {
      let response = await request.get(url + '/api/headerTestAction', {resolveWithFullResponse: true})
      expect(response.statusCode).to.equal(200)
      expect(response.headers.thing).to.equal('C')
    })

    it('but duplicate set-cookie requests should be allowed', async () => {
      let response = await request.get(url + '/api/headerTestAction', {resolveWithFullResponse: true})
      expect(response.statusCode).to.equal(200)
      expect(response.headers['set-cookie']).to.have.length(3) // 2 + session
      expect(response.headers['set-cookie'][1]).to.equal('value_1=1')
      expect(response.headers['set-cookie'][0]).to.equal('value_2=2')
    })

    it('should respond to OPTIONS with only HTTP headers', async () => {
      let response = await request({method: 'options', url: url + '/api/cacheTest', resolveWithFullResponse: true})
      expect(response.statusCode).to.equal(200)
      expect(response.headers['access-control-allow-methods']).to.equal('HEAD, GET, POST, PUT, PATCH, DELETE, OPTIONS, TRACE')
      expect(response.headers['access-control-allow-origin']).to.equal('*')
      expect(response.headers['content-length']).to.equal('0')
      expect(response.body).to.equal('')
    })

    it('should respond to TRACE with parsed params received', async () => {
      let response = await request({method: 'trace', url: url + '/api/x', form: {key: 'someKey', value: 'someValue'}, resolveWithFullResponse: true})
      expect(response.statusCode).to.equal(200)
      let body = await toJson(response.body)
      expect(body.receivedParams.key).to.equal('someKey')
      expect(body.receivedParams.value).to.equal('someValue')
    })

    it('should respond to HEAD requests just like GET, but with no body', async () => {
      let response = await request({method: 'head', url: url + '/api/headerTestAction', resolveWithFullResponse: true})
      expect(response.statusCode).to.equal(200)
      expect(response.body).to.equal('')
    })

    it('keeps sessions with browser_fingerprint', async () => {
      let j = request.jar()
      let response1 = await request.post({url: url + '/api/randomNumber', jar: j, resolveWithFullResponse: true})
      let response2 = await request.get({url: url + '/api/randomNumber', jar: j, resolveWithFullResponse: true})
      let response3 = await request.put({url: url + '/api/randomNumber', jar: j, resolveWithFullResponse: true})
      let response4 = await request.del({url: url + '/api/randomNumber', jar: j, resolveWithFullResponse: true})

      expect(response1.headers['set-cookie']).to.be.ok()
      expect(response2.headers['set-cookie']).to.not.exist()
      expect(response3.headers['set-cookie']).to.not.exist()
      expect(response4.headers['set-cookie']).to.not.exist()

      let body1 = await toJson(response1.body)
      let body2 = await toJson(response2.body)
      let body3 = await toJson(response3.body)
      let body4 = await toJson(response4.body)

      let fingerprint1 = body1.requesterInformation.id.split('-')[0]
      let fingerprint2 = body2.requesterInformation.id.split('-')[0]
      let fingerprint3 = body3.requesterInformation.id.split('-')[0]
      let fingerprint4 = body4.requesterInformation.id.split('-')[0]

      expect(fingerprint1).to.equal(fingerprint2)
      expect(fingerprint1).to.equal(fingerprint3)
      expect(fingerprint1).to.equal(fingerprint4)

      expect(fingerprint1).to.equal(body1.requesterInformation.fingerprint)
      expect(fingerprint2).to.equal(body2.requesterInformation.fingerprint)
      expect(fingerprint3).to.equal(body3.requesterInformation.fingerprint)
      expect(fingerprint4).to.equal(body4.requesterInformation.fingerprint)
    })
  })

  describe('http returnErrorCodes true', () => {
    let orig
    before(() => {
      orig = api.config.servers.web.returnErrorCodes
      api.config.servers.web.returnErrorCodes = true

      api.actions.versions.statusTestAction = [1]
      api.actions.actions.statusTestAction = {
        '1': {
          name: 'statusTestAction',
          description: 'I am a test',
          inputs: {
            key: {required: true}
          },
          run: (data) => {
            if (data.params.key !== 'value') {
              data.connection.rawConnection.responseHttpCode = 402
              throw new Error('key != value')
            } else {
              data.response.good = true
            }
          }
        }
      }

      api.routes.loadRoutes()
    })

    after(() => {
      api.config.servers.web.returnErrorCodes = orig
      delete api.actions.versions.statusTestAction
      delete api.actions.actions.statusTestAction
    })

    it('actions that do not exists should return 404', async () => {
      try {
        await request.post(url + '/api/aFakeAction')
        throw new Error('should not get here')
      } catch (error) {
        expect(error.statusCode).to.equal(404)
      }
    })

    it('missing params result in a 422', async () => {
      try {
        await request.post(url + '/api/statusTestAction')
        throw new Error('should not get here')
      } catch (error) {
        expect(error.statusCode).to.equal(422)
      }
    })

    it('status codes can be set for errors', async () => {
      try {
        await request.post(url + '/api/statusTestAction', {form: {key: 'bannana'}})
        throw new Error('should not get here')
      } catch (error) {
        expect(error.statusCode).to.equal(402)
        let body = await toJson(error.response.body)
        expect(body.error).to.equal('key != value')
      }
    })

    it('status code should still be 200 if everything is OK', async () => {
      let response = await request.post(url + '/api/statusTestAction', {form: {key: 'value'}, resolveWithFullResponse: true})
      expect(response.statusCode).to.equal(200)
      let body = await toJson(response.body)
      expect(body.good).to.equal(true)
    })
  })

  describe('documentation', () => {
    it('documentation can be returned via a documentation action', async () => {
      let body = await request.get(url + '/api/showDocumentation').then(toJson)
      expect(body.documentation).to.be.instanceof(Object)
    })

    it('should have actions with all the right parts', async () => {
      let body = await request.get(url + '/api/showDocumentation').then(toJson)
      for (let actionName in body.documentation) {
        for (let version in body.documentation[actionName]) {
          let action = body.documentation[actionName][version]
          expect(typeof action.name).to.equal('string')
          expect(typeof action.description).to.equal('string')
          expect(action.inputs).to.be.instanceof(Object)
        }
      }
    })
  })

  describe('files', () => {
    it('an HTML file', async () => {
      let response = await request.get(url + '/public/simple.html', {resolveWithFullResponse: true})
      expect(response.statusCode).to.equal(200)
      expect(response.body).to.equal('<h1>ActionHero</h1>\\nI am a flat file being served to you via the API from ./public/simple.html<br />')
    })

    it('404 pages', async () => {
      try {
        await request.get(url + '/public/notARealFile')
        throw new Error('should not get here')
      } catch (error) {
        expect(error.statusCode).to.equal(404)
        expect(error.body).not.to.match(/notARealFile/)
      }
    })

    it('404 pages from POST with if-modified-since header', async () => {
      let file = Math.random().toString(36)
      let options = {
        url: url + '/' + file,
        headers: {
          'if-modified-since': 'Thu, 19 Apr 2012 09:51:20 GMT'
        }
      }

      try {
        await request.get(options)
        throw new Error('should not get here')
      } catch (error) {
        expect(error.statusCode).to.equal(404)
        expect(error.response.body).to.equal('That file is not found')
      }
    })

    it('should not see files outside of the public dir', async () => {
      try {
        await request.get(url + '/public/../config.json')
        throw new Error('should not get here')
      } catch (error) {
        expect(error.statusCode).to.equal(404)
        expect(error.response.body).to.equal('That file is not found')
      }
    })

    it('index page should be served when requesting a path (trailing slash)', async () => {
      let response = await request.get(url + '/public/', {resolveWithFullResponse: true})
      expect(response.statusCode).to.equal(200)
      expect(response.body).to.match(/ActionHero.js is a multi-transport API Server with integrated cluster capabilities and delayed tasks/)
    })

    it('index page should be served when requesting a path (no trailing slash)', async () => {
      let response = await request.get(url + '/public', {resolveWithFullResponse: true})
      expect(response.statusCode).to.equal(200)
      expect(response.body).to.match(/ActionHero.js is a multi-transport API Server with integrated cluster capabilities and delayed tasks/)
    })

    describe('can serve files from a specific mapped route', () => {
      before(() => {
        let testFolderPublicPath = path.join(__dirname, '/../../public/testFolder')
        fs.mkdirSync(testFolderPublicPath)
        fs.writeFileSync(testFolderPublicPath + '/testFile.html', 'ActionHero Route Test File')
        api.routes.registerRoute('get', '/my/public/route', null, null, true, testFolderPublicPath)
      })

      after(() => {
        let testFolderPublicPath = path.join(__dirname, '/../../public/testFolder')
        fs.unlinkSync(testFolderPublicPath + path.sep + 'testFile.html')
        fs.rmdirSync(testFolderPublicPath)
      })

      it('works for routes mapped paths', async () => {
        let response = await request.get(url + '/my/public/route/testFile.html', {resolveWithFullResponse: true})
        expect(response.statusCode).to.equal(200)
        expect(response.body).to.equal('ActionHero Route Test File')
      })

      it('returns 404 for files not available in route mapped paths', async () => {
        try {
          await request.get(url + '/my/public/route/fileNotFound.html')
        } catch (error) {
          expect(error.statusCode).to.equal(404)
          expect(error.response.body).to.equal('That file is not found')
        }
      })

      it('should not see files outside of the mapped dir', async () => {
        try {
          await request.get(url + '/my/public/route/../../config/servers/web.js')
        } catch (error) {
          expect(error.statusCode).to.equal(404)
          expect(error.response.body).to.equal('That file is not found')
        }
      })
    })

    describe('can serve files from more than one directory', () => {
      let source = path.join(__dirname, '/../../public/simple.html')

      before(() => {
        fs.createReadStream(source).pipe(fs.createWriteStream(os.tmpdir() + path.sep + 'tmpTestFile.html'))
        api.staticFile.searchLoactions.push(os.tmpdir())
      })

      after(() => {
        fs.unlinkSync(os.tmpdir() + path.sep + 'tmpTestFile.html')
        api.staticFile.searchLoactions.pop()
      })

      it('works for secondary paths', async () => {
        let response = await request.get(url + '/public/tmpTestFile.html', {resolveWithFullResponse: true})
        expect(response.statusCode).to.equal(200)
        expect(response.body).to.equal('<h1>ActionHero</h1>\\nI am a flat file being served to you via the API from ./public/simple.html<br />')
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

      it('old action routes stop working', async () => {
        try {
          await request.get(url + '/api/randomNumber')
          throw new Error('should not get here')
        } catch (error) {
          expect(error.statusCode).to.equal(404)
        }
      })

      it('can ask for nested URL actions', async () => {
        let response = await request.get(url + '/craz/y/action/path/randomNumber', {resolveWithFullResponse: true})
        expect(response.statusCode).to.equal(200)
      })

      it('old file routes stop working', async () => {
        try {
          await request.get(url + '/public/simple.html')
          throw new Error('should not get here')
        } catch (error) {
          expect(error.statusCode).to.equal(404)
        }
      })

      it('can ask for nested URL files', async () => {
        let response = await request.get(url + '/a/b/c/simple.html', {resolveWithFullResponse: true})
        expect(response.statusCode).to.equal(200)
        expect(response.body).to.equal('<h1>ActionHero</h1>\\nI am a flat file being served to you via the API from ./public/simple.html<br />')
      })

      it('can ask for nested URL files with depth', async () => {
        let response = await request.get(url + '/a/b/c/css/cosmo.css', {resolveWithFullResponse: true})
        expect(response.statusCode).to.equal(200)
      })
    })
  })

  describe('routes', () => {
    let originalRoutes
    before(() => {
      originalRoutes = api.routes.routes
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
          run: (data) => {
            data.response.matchedRoute = data.connection.matchedRoute
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
          run: (data) => {
            data.response.user_id = data.params.user_id
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
          run: (data) => {
            data.response.userID = data.params.userID
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
    })

    after(() => {
      api.routes.routes = originalRoutes
      delete api.actions.versions.mimeTestAction
      delete api.actions.actions.mimeTestAction
      delete api.actions.versions.login
      delete api.actions.actions.login
    })

    it('new params will not be allowed in route definitions (an action should do it)', () => {
      expect(api.params.postVariables).not.to.contain('bogusID')
    })

    it('\'all\' routes are duplicated properly', () => {
      ['get', 'post', 'put', 'delete'].forEach((verb) => {
        expect(api.routes.routes[verb][0].action).to.equal('user')
        expect(api.routes.routes[verb][0].path).to.equal('/user/:userID')
      })
    })

    it('unknown actions are still unknown', async () => {
      try {
        await request.get(url + '/api/a_crazy_action')
        throw new Error('should not get here')
      } catch (error) {
        expect(error.statusCode).to.equal(404)
        let body = await toJson(error.response.body)
        expect(body.error).to.equal('unknown action or invalid apiVersion')
      }
    })

    it('explicit action declarations still override routed actions, if the defined action is real', async () => {
      let body = await request.get(url + '/api/user/123?action=randomNumber').then(toJson)
      expect(body.requesterInformation.receivedParams.action).to.equal('randomNumber')
    })

    it('route actions will override explicit actions, if the defined action is null', async () => {
      try {
        await request.get(url + '/api/user/123?action=someFakeAction').then(toJson)
        throw new Error('should not get here')
      } catch (error) {
        expect(error.statusCode).to.equal(404)
        let body = await toJson(error.response.body)
        expect(body.requesterInformation.receivedParams.action).to.equal('user')
      }
    })

    it('route actions have the matched route availalbe to the action', async () => {
      let body = await request.get(url + '/api/mimeTestAction/thing.json').then(toJson)
      expect(body.matchedRoute.path).to.equal('/mimeTestAction/:key')
      expect(body.matchedRoute.action).to.equal('mimeTestAction')
    })

    it('Routes should recognize apiVersion as default param', async () => {
      let body = await request.get(url + '/api/old_login?user_id=7').then(toJson)
      expect(body.user_id).to.equal('7')
      expect(body.requesterInformation.receivedParams.action).to.equal('login')
    })

    it('Routes should be mapped for GET (simple)', async () => {
      try {
        await request.get(url + '/api/users').then(toJson)
        throw new Error('should not get here')
      } catch (error) {
        expect(error.statusCode).to.equal(404)
        let body = await toJson(error.response.body)
        expect(body.requesterInformation.receivedParams.action).to.equal('usersList')
      }
    })

    it('Routes should be mapped for GET (complex)', async () => {
      try {
        await request.get(url + '/api/user/1234').then(toJson)
        throw new Error('should not get here')
      } catch (error) {
        expect(error.statusCode).to.equal(404)
        let body = await toJson(error.response.body)
        expect(body.requesterInformation.receivedParams.action).to.equal('user')
        expect(body.requesterInformation.receivedParams.userID).to.equal('1234')
      }
    })

    it('Routes should be mapped for POST', async () => {
      try {
        await request.post(url + '/api/user/1234?key=value').then(toJson)
        throw new Error('should not get here')
      } catch (error) {
        expect(error.statusCode).to.equal(404)
        let body = await toJson(error.response.body)
        expect(body.requesterInformation.receivedParams.action).to.equal('user')
        expect(body.requesterInformation.receivedParams.userID).to.equal('1234')
        expect(body.requesterInformation.receivedParams.key).to.equal('value')
      }
    })

    it('Routes should be mapped for PUT', async () => {
      try {
        await request.put(url + '/api/user/1234?key=value').then(toJson)
        throw new Error('should not get here')
      } catch (error) {
        expect(error.statusCode).to.equal(404)
        let body = await toJson(error.response.body)
        expect(body.requesterInformation.receivedParams.action).to.equal('user')
        expect(body.requesterInformation.receivedParams.userID).to.equal('1234')
        expect(body.requesterInformation.receivedParams.key).to.equal('value')
      }
    })

    it('Routes should be mapped for DELETE', async () => {
      try {
        await request.del(url + '/api/user/1234?key=value').then(toJson)
        throw new Error('should not get here')
      } catch (error) {
        expect(error.statusCode).to.equal(404)
        let body = await toJson(error.response.body)
        expect(body.requesterInformation.receivedParams.action).to.equal('user')
        expect(body.requesterInformation.receivedParams.userID).to.equal('1234')
        expect(body.requesterInformation.receivedParams.key).to.equal('value')
      }
    })

    it('route params trump explicit params', async () => {
      try {
        await request.get(url + '/api/user/1?userID=2').then(toJson)
        throw new Error('should not get here')
      } catch (error) {
        expect(error.statusCode).to.equal(404)
        let body = await toJson(error.response.body)
        expect(body.requesterInformation.receivedParams.action).to.equal('user')
        expect(body.requesterInformation.receivedParams.userID).to.equal('1')
      }
    })

    it('to match, a route much match all parts of the URL', async () => {
      try {
        await request.get(url + '/api/thing').then(toJson)
        throw new Error('should not get here')
      } catch (error) {
        expect(error.statusCode).to.equal(404)
        let body = await toJson(error.response.body)
        expect(body.requesterInformation.receivedParams.action).to.equal('thing')
      }

      try {
        await request.get(url + '/api/thing/stuff').then(toJson)
        throw new Error('should not get here')
      } catch (error) {
        expect(error.statusCode).to.equal(404)
        let body = await toJson(error.response.body)
        expect(body.requesterInformation.receivedParams.action).to.equal('thingStuff')
      }
    })

    it('regexp matches will provide proper variables', async () => {
      let body = await request.post(url + '/api/login/123').then(toJson)
      expect(body.requesterInformation.receivedParams.action).to.equal('login')
      expect(body.requesterInformation.receivedParams.userID).to.equal('123')

      let bodyAgain = await request.post(url + '/api/login/admin').then(toJson)
      expect(bodyAgain.requesterInformation.receivedParams.action).to.equal('login')
      expect(bodyAgain.requesterInformation.receivedParams.userID).to.equal('admin')
    })

    it('regexp matches will still work with params with periods and other wacky chars', async () => {
      let body = await request.get(url + '/api/c/key/log_me-in.com$123.').then(toJson)
      expect(body.requesterInformation.receivedParams.action).to.equal('cacheTest')
      expect(body.requesterInformation.receivedParams.value).to.equal('log_me-in.com$123.')
    })

    it('regexp match failures will be rejected', async () => {
      try {
        await request.get(url + '/api/login/1234').then(toJson)
        throw new Error('should not get here')
      } catch (error) {
        expect(error.statusCode).to.equal(404)
        let body = await toJson(error.response.body)
        expect(body.error).to.equal('unknown action or invalid apiVersion')
        expect(body.requesterInformation.receivedParams.userID).to.not.exist()
      }
    })

    describe('file extensions + routes', () => {
      it('will change header information based on extension (when active)', async () => {
        let response = await request.get(url + '/api/mimeTestAction/val.png', {resolveWithFullResponse: true})
        expect(response.headers['content-type']).to.equal('image/png')
      })

      it('will not change header information if there is a connection.error', async () => {
        try {
          await request.get(url + '/api/mimeTestAction')
          throw new Error('should not get here')
        } catch (error) {
          expect(error.statusCode).to.equal(422)
          let body = await toJson(error.response.body)
          expect(error.response.headers['content-type']).to.equal('application/json; charset=utf-8')
          expect(body.error).to.equal('key is a required parameter for this action')
        }
      })

      it('works with with matchTrailingPathParts', async () => {
        let body = await request.get(url + '/api/a/wild/theKey/and/some/more/path').then(toJson)
        expect(body.requesterInformation.receivedParams.action).to.equal('mimeTestAction')
        expect(body.requesterInformation.receivedParams.path).to.equal('and/some/more/path')
        expect(body.requesterInformation.receivedParams.key).to.equal('theKey')
      })
    })

    describe('spaces in URL with public files', () => {
      let source = path.join(__dirname, '/../../public/logo/actionhero.png')

      before(async () => {
        let tmpDir = os.tmpdir()
        let readStream = fs.createReadStream(source)
        api.staticFile.searchLoactions.push(tmpDir)

        await new Promise((resolve) => {
          readStream.pipe(fs.createWriteStream(tmpDir + path.sep + 'actionhero with space.png'))
          readStream.on('close', resolve)
        })
      })

      after(() => {
        fs.unlinkSync(os.tmpdir() + path.sep + 'actionhero with space.png')
        api.staticFile.searchLoactions.pop()
      })

      it('will decode %20 or plus sign to a space so that file system can read', async () => {
        let response = await request.get(url + '/actionhero%20with%20space.png', {resolveWithFullResponse: true})
        expect(response.statusCode).to.equal(200)
        expect(response.body).to.match(/PNG/)
        expect(response.headers['content-type']).to.equal('image/png')
      })

      it('will capture bad encoding in URL and return NOT FOUND', async () => {
        try {
          await request.get(url + '/actionhero%20%%%%%%%%%%with+space.png')
          throw new Error('should not get here')
        } catch (error) {
          expect(error.statusCode).to.equal(404)
          expect(typeof error.response.body).to.equal('string')
          expect(error.response.body).to.match(/^That file is not found/)
        }
      })
    })
  })

  describe('it should work with server custom methods', () => {
    let originalRoutes
    before(() => {
      originalRoutes = api.routes.routes
      api.actions.versions.proxyHeaders = [1]
      api.actions.actions.proxyHeaders = {
        '1': {
          name: 'proxyHeaders',
          description: 'proxy test',
          inputs: {},
          outputExample: {},
          run: (data) => {
            data.connection.setHeader('X-Foo', 'bar')
          }
        }
      }

      api.routes.loadRoutes({
        get: [
          {path: '/proxy', action: 'proxyHeaders', apiVersion: 1}
        ]
      })
    })

    after(() => {
      api.routes.routes = originalRoutes
      delete api.actions.versions.proxyHeaders
      delete api.actions.actions.proxyHeaders
    })

    it('actions handled by the web server support proxy for setHeaders', async () => {
      let response = await request.get(url + '/api/proxy', {resolveWithFullResponse: true})
      expect(response.headers['x-foo']).to.exist.and.be.equal('bar')
    })
  })
})
