'use strict'

const request = require('request-promise-native')
const fs = require('fs')
const os = require('os')
const path = require('path')
const { PassThrough } = require('stream')
const ActionHero = require(path.join(__dirname, '/../../index.js'))
const actionhero = new ActionHero.Process()
let api
let url

async function exec (command) {
  return new Promise((resolve, reject) => {
    require('child_process').exec(command, (error, stdout, stderr) => {
      if (error) { return reject(error) }
      return resolve({stdout, stderr})
    })
  })
}

const toJson = async (string) => {
  try {
    return JSON.parse(string)
  } catch (error) {
    return error
  }
}

describe('Server: Web', () => {
  beforeAll(async () => {
    api = await actionhero.start()
    url = 'http://localhost:' + api.config.servers.web.port
  })

  afterAll(async () => { await actionhero.stop() })

  test('should be up and return data', async () => {
    await request.get(url + '/api/randomNumber').then(toJson)
    // should throw no errors
  })

  test('basic response should be JSON and have basic data', async () => {
    let body = await request.get(url + '/api/randomNumber').then(toJson)
    expect(body).toBeInstanceOf(Object)
    expect(body.requesterInformation).toBeInstanceOf(Object)
  })

  test('returns JSON with errors', async () => {
    try {
      await request.get(url + '/api').then(toJson)
      throw new Error('should not get here')
    } catch (error) {
      expect(error.statusCode).toEqual(404)
      let body = await toJson(error.response.body)
      expect(body.requesterInformation).toBeInstanceOf(Object)
    }
  })

  test('params work', async () => {
    try {
      await request.get(url + '/api?key=value').then(toJson)
      throw new Error('should not get here')
    } catch (error) {
      expect(error.statusCode).toEqual(404)
      let body = await toJson(error.response.body)
      expect(body.requesterInformation.receivedParams.key).toEqual('value')
    }
  })

  test('params are ignored unless they are in the whitelist', async () => {
    try {
      await request.get(url + '/api?crazyParam123=something').then(toJson)
      throw new Error('should not get here')
    } catch (error) {
      expect(error.statusCode).toEqual(404)
      let body = await toJson(error.response.body)
      expect(body.requesterInformation.receivedParams.crazyParam123).toBeUndefined()
    }
  })

  describe('will properly destroy connections', () => {
    beforeAll(() => {
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

    afterAll(() => {
      delete api.actions.actions.customRender
      delete api.actions.versions.customRender
    })

    test('works for the API', async () => {
      expect(Object.keys(api.connections.connections)).toHaveLength(0)
      request.get(url + '/api/sleepTest').then(toJson) // don't await

      await api.utils.sleep(100)
      expect(Object.keys(api.connections.connections)).toHaveLength(1)

      await api.utils.sleep(1000)
      expect(Object.keys(api.connections.connections)).toHaveLength(0)
    })

    test('works for files', async () => {
      expect(Object.keys(api.connections.connections)).toHaveLength(0)
      await request.get(url + '/simple.html')
      await api.utils.sleep(100)
      expect(Object.keys(api.connections.connections)).toHaveLength(0)
    })

    test('works for actions with toRender: false', async () => {
      expect(Object.keys(api.connections.connections)).toHaveLength(0)
      let body = await request.get(url + '/api/customRender').then(toJson)
      expect(body).toBeTruthy()
      await api.utils.sleep(100)
      expect(Object.keys(api.connections.connections)).toHaveLength(0)
    })
  })

  describe('errors', () => {
    beforeAll(() => {
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

    afterAll(() => {
      delete api.actions.actions.stringErrorTestAction
      delete api.actions.versions.stringErrorTestAction
      delete api.actions.actions.errorErrorTestAction
      delete api.actions.versions.errorErrorTestAction
      delete api.actions.actions.complexErrorTestAction
      delete api.actions.versions.complexErrorTestAction
    })

    test('errors can be error strings', async () => {
      try {
        await request.get(url + '/api/stringErrorTestAction')
        throw new Error('should not get here')
      } catch (error) {
        expect(error.statusCode).toEqual(400)
        let body = await toJson(error.response.body)
        expect(body.error).toEqual('broken')
      }
    })

    test('errors can be error objects and returned plainly', async () => {
      try {
        await request.get(url + '/api/errorErrorTestAction')
        throw new Error('should not get here')
      } catch (error) {
        expect(error.statusCode).toEqual(400)
        let body = await toJson(error.response.body)
        expect(body.error).toEqual('broken')
      }
    })

    test('errors can be complex JSON payloads', async () => {
      try {
        await request.get(url + '/api/complexErrorTestAction')
        throw new Error('should not get here')
      } catch (error) {
        expect(error.statusCode).toEqual(400)
        let body = await toJson(error.response.body)
        expect(body.error).toEqual({ error: 'broken', reason: 'stuff' })
      }
    })
  })

  describe('if disableParamScrubbing is set', () => {
    let orig
    beforeAll(() => {
      orig = api.config.general.disableParamScrubbing
      api.config.general.disableParamScrubbing = true
    })

    afterAll(() => {
      api.config.general.disableParamScrubbing = orig
    })

    test('params are not ignored', async () => {
      try {
        await request.get(url + '/api/testAction/?crazyParam123=something')
        throw new Error('should not get here')
      } catch (error) {
        expect(error.statusCode).toEqual(404)
        let body = await toJson(error.response.body)
        expect(body.requesterInformation.receivedParams.crazyParam123).toEqual('something')
      }
    })
  })

  describe('JSONp', () => {
    let orig
    beforeAll(() => {
      orig = api.config.servers.web.metadataOptions.requesterInformation
      api.config.servers.web.metadataOptions.requesterInformation = false
    })

    afterAll(() => {
      api.config.servers.web.metadataOptions.requesterInformation = orig
    })

    test('can ask for JSONp responses', async () => {
      let response = await request.get(url + '/api/randomNumber?callback=myCallback')
      expect(response.indexOf('myCallback({')).toEqual(0)
      expect(response.indexOf('Your random number is')).toBeGreaterThan(0)
    })

    test('JSONp responses cannot be used for XSS', async () => {
      let response = await request.get(url + '/api/randomNumber?callback=alert(%27hi%27);foo')
      expect(response).not.toMatch(/alert\(/)
      expect(response.indexOf('alert&#39;hi&#39;;foo(')).toEqual(0)
    })
  })

  describe('request redirecton (allowedRequestHosts)', () => {
    let orig
    beforeAll(() => {
      orig = api.config.servers.web.allowedRequestHosts
      api.config.servers.web.allowedRequestHosts = ['https://www.site.com']
    })

    afterAll(() => { api.config.servers.web.allowedRequestHosts = orig })

    test(
      'will redirect clients if they do not request the proper host',
      async () => {
        try {
          await request.get({
            followRedirect: false,
            url: url + '/api/randomNumber',
            headers: {'Host': 'lalala.site.com'}
          })
          throw new Error('should not get here')
        } catch (error) {
          expect(error.statusCode).toEqual(302)
          expect(error.response.body).toMatch(/You are being redirected to https:\/\/www.site.com\/api\/randomNumber/)
        }
      }
    )

    test('will allow API access from the proper hosts', async () => {
      let response = await request.get({
        followRedirect: false,
        url: url + '/api/randomNumber',
        headers: {
          'Host': 'www.site.com',
          'x-forwarded-proto': 'https'
        }
      })

      expect(response).toMatch(/randomNumber/)
    })
  })

  test('gibberish actions have the right response', async () => {
    try {
      await request.get(url + '/api/IAMNOTANACTION')
      throw new Error('should not get here')
    } catch (error) {
      expect(error.statusCode).toEqual(404)
      let body = await toJson(error.response.body)
      expect(body.error).toEqual('unknown action or invalid apiVersion')
    }
  })

  test('real actions do not have an error response', async () => {
    let body = await request.get(url + '/api/status').then(toJson)
    expect(body.error).toBeUndefined()
  })

  test('HTTP Verbs should work: GET', async () => {
    let body = await request.get(url + '/api/randomNumber').then(toJson)
    expect(body.randomNumber).toBeGreaterThanOrEqual(0)
    expect(body.randomNumber).toBeLessThan(1)
  })

  test('HTTP Verbs should work: PUT', async () => {
    let body = await request.put(url + '/api/randomNumber').then(toJson)
    expect(body.randomNumber).toBeGreaterThanOrEqual(0)
    expect(body.randomNumber).toBeLessThan(1)
  })

  test('HTTP Verbs should work: POST', async () => {
    let body = await request.post(url + '/api/randomNumber').then(toJson)
    expect(body.randomNumber).toBeGreaterThanOrEqual(0)
    expect(body.randomNumber).toBeLessThan(100)
  })

  test('HTTP Verbs should work: DELETE', async () => {
    let body = await request.delete(url + '/api/randomNumber').then(toJson)
    expect(body.randomNumber).toBeGreaterThanOrEqual(0)
    expect(body.randomNumber).toBeLessThan(1000)
  })

  test('HTTP Verbs should work: Post with Form', async () => {
    try {
      await request.post(url + '/api/cacheTest', {form: {key: 'key'}})
      throw new Error('should not get here')
    } catch (error) {
      expect(error.statusCode).toEqual(422)
      expect(error.message).toMatch(/value is a required parameter for this action/)
    }

    let successBody = await request.post(url + '/api/cacheTest', {form: {key: 'key', value: 'value'}}).then(toJson)
    expect(successBody.cacheTestResults.saveResp).toEqual(true)
  })

  test('HTTP Verbs should work: Post with JSON Payload as body', async () => {
    let bodyPayload = JSON.stringify({key: 'key'})
    try {
      await request.post(url + '/api/cacheTest', {'body': bodyPayload, 'headers': {'Content-type': 'application/json'}})
      throw new Error('should not get here')
    } catch (error) {
      expect(error.statusCode).toEqual(422)
      expect(error.message).toMatch(/value is a required parameter for this action/)
    }

    bodyPayload = JSON.stringify({key: 'key', value: 'value'})
    let successBody = await request.post(url + '/api/cacheTest', {'body': bodyPayload, 'headers': {'Content-type': 'application/json'}}).then(toJson)
    expect(successBody.cacheTestResults.saveResp).toEqual(true)
  })

  describe('connection.rawConnection.params', () => {
    beforeAll(() => {
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

    afterAll(() => {
      delete api.actions.actions.paramTestAction
      delete api.actions.versions.paramTestAction
    })

    test('.query should contain unfiltered query params', async () => {
      let body = await request.get(url + '/api/paramTestAction/?crazyParam123=something').then(toJson)
      expect(body.query.crazyParam123).toEqual('something')
    })

    test(
      '.body should contain unfiltered, parsed request body params',
      async () => {
        let requestBody = JSON.stringify({key: 'value'})
        let body = await request.post(url + '/api/paramTestAction', {'body': requestBody, 'headers': {'Content-type': 'application/json'}}).then(toJson)
        expect(body.body.key).toEqual('value')
      }
    )

    describe('connection.rawConnection.rawBody', () => {
      let orig
      beforeAll(() => { orig = api.config.servers.web.saveRawBody })
      afterAll(() => { api.config.servers.web.saveRawBody = orig })

      test('.rawBody will contain the raw POST body without parsing', async () => {
        api.config.servers.web.saveRawBody = true
        let requestBody = '{"key":      "value"}'
        let body = await request.post(url + '/api/paramTestAction', {'body': requestBody, 'headers': {'Content-type': 'application/json'}}).then(toJson)
        expect(body.body.key).toEqual('value')
        expect(body.rawBody).toEqual('{"key":      "value"}')
      })

      test('.rawBody can be disabled', async () => {
        api.config.servers.web.saveRawBody = false
        let requestBody = '{"key":      "value"}'
        let body = await request.post(url + '/api/paramTestAction', {'body': requestBody, 'headers': {'Content-type': 'application/json'}}).then(toJson)
        expect(body.body.key).toEqual('value')
        expect(body.rawBody).toEqual('')
      })

      describe('invalid/improper mime types', () => {
        beforeAll(() => { api.config.servers.web.saveRawBody = true })

        test(
          '.body will be empty if the content-type cannot be handled by formidable and not crash',
          async () => {
            let requestBody = '<texty>this is like xml</texty>'
            let body = await request.post(url + '/api/paramTestAction', {'body': requestBody, 'headers': {'Content-type': 'text/xml'}}).then(toJson)
            expect(body.body).toEqual({})
            expect(body.rawBody).toEqual(requestBody)
          }
        )

        test(
          'will set the body properly if mime type is wrong (bad header)',
          async () => {
            let requestBody = '<texty>this is like xml</texty>'
            let body = await request.post(url + '/api/paramTestAction', {'body': requestBody, 'headers': {'Content-type': 'application/json'}}).then(toJson)
            expect(body.body).toEqual({})
            expect(body.rawBody).toEqual(requestBody)
          }
        )

        test('will set the body properly if mime type is wrong (text)', async () => {
          let requestBody = 'I am normal \r\n text with \r\n line breaks'
          let body = await request.post(url + '/api/paramTestAction', {'body': requestBody, 'headers': {'Content-type': 'text/plain'}}).then(toJson)
          expect(body.body).toEqual({})
          expect(body.rawBody).toEqual(requestBody)
        })

        test('rawBody will exist if the content-type cannot be handled by formidable', async () => {
          let requestPart1 = '<texty><innerNode>more than'
          let requestPart2 = ' two words</innerNode></texty>'

          var bufferStream = new PassThrough()
          var req = request.post(url + '/api/paramTestAction', {headers: {'Content-type': 'text/xml'}})
          bufferStream.write(Buffer.from(requestPart1)) // write the first part
          bufferStream.pipe(req)
          setTimeout(() => {
            bufferStream.end(Buffer.from(requestPart2)) // end signals no more is coming
          }, 50)

          await new Promise((resolve, reject) => {
            bufferStream.on('finish', resolve)
          })
          var respString = await req
          var resp = JSON.parse(respString)
          expect(resp.error).toBeUndefined()
          expect(resp.body).toEqual({})
          expect(resp.rawBody).toEqual(requestPart1 + requestPart2)
        })

        test('rawBody and form will process JSON with odd stream testing', async () => {
          let requestJson = { a: 1, b: 'two' }
          let requestString = JSON.stringify(requestJson)
          let middleIdx = Math.floor(requestString.length / 2)
          let requestPart1 = requestString.substring(0, middleIdx)
          let requestPart2 = requestString.substring(middleIdx)

          var bufferStream = new PassThrough()
          var req = request.post(url + '/api/paramTestAction', {'headers': {'Content-type': 'application/json'}})
          bufferStream.write(Buffer.from(requestPart1)) // write the first part
          bufferStream.pipe(req)
          setTimeout(() => {
            bufferStream.end(Buffer.from(requestPart2)) // end signals no more is coming
          }, 50)

          await new Promise((resolve, reject) => {
            bufferStream.on('finish', resolve)
          })
          var respString = await req
          var resp = JSON.parse(respString)
          expect(resp.error).toBeUndefined()
          expect(resp.body).toEqual(requestJson)
          expect(resp.rawBody).toEqual(requestString)
        })

        test('rawBody processing will not hang on writable error', async () => {
          let requestPart1 = '<texty><innerNode>more than'

          var bufferStream = new PassThrough()
          var req = request.post(url + '/api/paramTestAction', {headers: {'Content-type': 'text/xml'}})
          bufferStream.write(Buffer.from(requestPart1)) // write the first part
          bufferStream.pipe(req)
          setTimeout(() => {
            bufferStream.destroy(new Error('This stream is broken.')) // sends an error and closes the stream
          }, 50)

          await new Promise((resolve, reject) => {
            bufferStream.on('finish', resolve)
            bufferStream.on('error', resolve)
          })
          var respString = await req
          var resp = JSON.parse(respString)
          expect(resp.error).toBeUndefined()
          expect(resp.body).toEqual({})
          expect(resp.rawBody).toEqual(requestPart1) // stream ends with only one part processed
        })
      })
    })
  })

  describe('errorCodes', () => {
    let orig
    beforeAll(() => { orig = api.config.servers.web.returnErrorCodes })
    afterAll(() => { api.config.servers.web.returnErrorCodes = orig })

    test('returnErrorCodes false should still have a status of 200', async () => {
      api.config.servers.web.returnErrorCodes = false
      let response = await request.del(url + '/api/', {resolveWithFullResponse: true})
      expect(response.statusCode).toEqual(200)
    })

    test('returnErrorCodes can be opted to change http header codes', async () => {
      api.config.servers.web.returnErrorCodes = true
      try {
        await request.del(url + '/api/')
      } catch (error) {
        expect(error.statusCode).toEqual(404)
      }
    })
  })

  describe('http header', () => {
    beforeAll(() => {
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

    afterAll(() => {
      delete api.actions.actions.headerTestAction
      delete api.actions.versions.headerTestAction
    })

    test(
      'duplicate headers should be removed (in favor of the last set)',
      async () => {
        let response = await request.get(url + '/api/headerTestAction', {resolveWithFullResponse: true})
        expect(response.statusCode).toEqual(200)
        expect(response.headers.thing).toEqual('C')
      }
    )

    test('but duplicate set-cookie requests should be allowed', async () => {
      let response = await request.get(url + '/api/headerTestAction', {resolveWithFullResponse: true})
      expect(response.statusCode).toEqual(200)
      let parts = response.headers['set-cookie'][0].split(',')
      expect(parts[1]).toEqual('value_1=1')
      expect(parts[0]).toEqual('value_2=2')
    })

    test('should respond to OPTIONS with only HTTP headers', async () => {
      let response = await request({method: 'options', url: url + '/api/cacheTest', resolveWithFullResponse: true})
      expect(response.statusCode).toEqual(200)
      expect(response.headers['access-control-allow-methods']).toEqual('HEAD, GET, POST, PUT, PATCH, DELETE, OPTIONS, TRACE')
      expect(response.headers['access-control-allow-origin']).toEqual('*')
      expect(response.headers['content-length']).toEqual('0')
      expect(response.body).toEqual('')
    })

    test('should respond to TRACE with parsed params received', async () => {
      let response = await request({method: 'trace', url: url + '/api/x', form: {key: 'someKey', value: 'someValue'}, resolveWithFullResponse: true})
      expect(response.statusCode).toEqual(200)
      let body = await toJson(response.body)
      expect(body.receivedParams.key).toEqual('someKey')
      expect(body.receivedParams.value).toEqual('someValue')
    })

    test(
      'should respond to HEAD requests just like GET, but with no body',
      async () => {
        let response = await request({method: 'head', url: url + '/api/headerTestAction', resolveWithFullResponse: true})
        expect(response.statusCode).toEqual(200)
        expect(response.body).toEqual('')
      }
    )

    test('keeps sessions with browser_fingerprint', async () => {
      let j = request.jar()
      let response1 = await request.post({url: url + '/api/randomNumber', jar: j, resolveWithFullResponse: true})
      let response2 = await request.get({url: url + '/api/randomNumber', jar: j, resolveWithFullResponse: true})
      let response3 = await request.put({url: url + '/api/randomNumber', jar: j, resolveWithFullResponse: true})
      let response4 = await request.del({url: url + '/api/randomNumber', jar: j, resolveWithFullResponse: true})

      expect(response1.headers['set-cookie']).toBeTruthy()
      expect(response2.headers['set-cookie']).toBeUndefined()
      expect(response3.headers['set-cookie']).toBeUndefined()
      expect(response4.headers['set-cookie']).toBeUndefined()

      let body1 = await toJson(response1.body)
      let body2 = await toJson(response2.body)
      let body3 = await toJson(response3.body)
      let body4 = await toJson(response4.body)

      let fingerprint1 = body1.requesterInformation.id.split('-')[0]
      let fingerprint2 = body2.requesterInformation.id.split('-')[0]
      let fingerprint3 = body3.requesterInformation.id.split('-')[0]
      let fingerprint4 = body4.requesterInformation.id.split('-')[0]

      expect(fingerprint1).toEqual(fingerprint2)
      expect(fingerprint1).toEqual(fingerprint3)
      expect(fingerprint1).toEqual(fingerprint4)

      expect(fingerprint1).toEqual(body1.requesterInformation.fingerprint)
      expect(fingerprint2).toEqual(body2.requesterInformation.fingerprint)
      expect(fingerprint3).toEqual(body3.requesterInformation.fingerprint)
      expect(fingerprint4).toEqual(body4.requesterInformation.fingerprint)
    })
  })

  describe('http returnErrorCodes true', () => {
    let orig
    beforeAll(() => {
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

    afterAll(() => {
      api.config.servers.web.returnErrorCodes = orig
      delete api.actions.versions.statusTestAction
      delete api.actions.actions.statusTestAction
    })

    test('actions that do not exists should return 404', async () => {
      try {
        await request.post(url + '/api/aFakeAction')
        throw new Error('should not get here')
      } catch (error) {
        expect(error.statusCode).toEqual(404)
      }
    })

    test('missing params result in a 422', async () => {
      try {
        await request.post(url + '/api/statusTestAction')
        throw new Error('should not get here')
      } catch (error) {
        expect(error.statusCode).toEqual(422)
      }
    })

    test('status codes can be set for errors', async () => {
      try {
        await request.post(url + '/api/statusTestAction', {form: {key: 'bannana'}})
        throw new Error('should not get here')
      } catch (error) {
        expect(error.statusCode).toEqual(402)
        let body = await toJson(error.response.body)
        expect(body.error).toEqual('key != value')
      }
    })

    test('status code should still be 200 if everything is OK', async () => {
      let response = await request.post(url + '/api/statusTestAction', {form: {key: 'value'}, resolveWithFullResponse: true})
      expect(response.statusCode).toEqual(200)
      let body = await toJson(response.body)
      expect(body.good).toEqual(true)
    })
  })

  describe('documentation', () => {
    test('documentation can be returned via a documentation action', async () => {
      let body = await request.get(url + '/api/showDocumentation').then(toJson)
      expect(body.documentation).toBeInstanceOf(Object)
    })

    test('should have actions with all the right parts', async () => {
      let body = await request.get(url + '/api/showDocumentation').then(toJson)
      for (let actionName in body.documentation) {
        for (let version in body.documentation[actionName]) {
          let action = body.documentation[actionName][version]
          expect(typeof action.name).toEqual('string')
          expect(typeof action.description).toEqual('string')
          expect(action.inputs).toBeInstanceOf(Object)
        }
      }
    })
  })

  describe('files', () => {
    test('an HTML file', async () => {
      let response = await request.get(url + '/public/simple.html', {resolveWithFullResponse: true})
      expect(response.statusCode).toEqual(200)
      expect(response.body).toEqual('<h1>ActionHero</h1>\\nI am a flat file being served to you via the API from ./public/simple.html<br />')
    })

    test('404 pages', async () => {
      try {
        await request.get(url + '/public/notARealFile')
        throw new Error('should not get here')
      } catch (error) {
        expect(error.statusCode).toEqual(404)
      }
    })

    test('404 pages from POST with if-modified-since header', async () => {
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
        expect(error.statusCode).toEqual(404)
        expect(error.response.body).toEqual('That file is not found')
      }
    })

    test('should not see files outside of the public dir', async () => {
      try {
        await request.get(url + '/public/../config.json')
        throw new Error('should not get here')
      } catch (error) {
        expect(error.statusCode).toEqual(404)
        expect(error.response.body).toEqual('That file is not found')
      }
    })

    test(
      'index page should be served when requesting a path (trailing slash)',
      async () => {
        let response = await request.get(url + '/public/', {resolveWithFullResponse: true})
        expect(response.statusCode).toEqual(200)
        expect(response.body).toMatch(/ActionHero.js is a multi-transport API Server with integrated cluster capabilities and delayed tasks/)
      }
    )

    test(
      'index page should be served when requesting a path (no trailing slash)',
      async () => {
        let response = await request.get(url + '/public', {resolveWithFullResponse: true})
        expect(response.statusCode).toEqual(200)
        expect(response.body).toMatch(/ActionHero.js is a multi-transport API Server with integrated cluster capabilities and delayed tasks/)
      }
    )

    if (process.platform === 'win32') {
      console.log('*** CANNOT RUN FILE DESCRIPTOR TESTS ON WINDOWS.  Sorry. ***')
    } else {
      describe('do not leave open file descriptors ', () => {
        const lsofChk = async () => {
          const {stdout} = await exec('lsof -n -P|grep "/simple.html"|wc -l')
          return stdout.trim()
        }

        test('closes all descriptors on statusCode 200 responses', async () => {
          let response = await request.get(url + '/simple.html', {resolveWithFullResponse: true})
          expect(response.statusCode).toEqual(200)
          await api.utils.sleep(100)
          expect(await lsofChk()).toEqual('0')
        })

        test('closes all descriptors on statusCode 304 responses', async () => {
          try {
            await request.get(url + '/simple.html', {headers: {'if-none-match': '*'}, resolveWithFullResponse: true})
            throw new Error('should return 304')
          } catch (error) {
            expect(error.statusCode).toEqual(304)
            await api.utils.sleep(100)
            expect(await lsofChk()).toEqual('0')
          }
        })
      })
    }

    describe('can serve files from a specific mapped route', () => {
      beforeAll(() => {
        let testFolderPublicPath = path.join(__dirname, '/../../public/testFolder')
        fs.mkdirSync(testFolderPublicPath)
        fs.writeFileSync(testFolderPublicPath + '/testFile.html', 'ActionHero Route Test File')
        api.routes.registerRoute('get', '/my/public/route', null, null, true, testFolderPublicPath)
      })

      afterAll(() => {
        let testFolderPublicPath = path.join(__dirname, '/../../public/testFolder')
        fs.unlinkSync(testFolderPublicPath + path.sep + 'testFile.html')
        fs.rmdirSync(testFolderPublicPath)
      })

      test('works for routes mapped paths', async () => {
        let response = await request.get(url + '/my/public/route/testFile.html', {resolveWithFullResponse: true})
        expect(response.statusCode).toEqual(200)
        expect(response.body).toEqual('ActionHero Route Test File')
      })

      test('returns 404 for files not available in route mapped paths', async () => {
        try {
          await request.get(url + '/my/public/route/fileNotFound.html')
        } catch (error) {
          expect(error.statusCode).toEqual(404)
          expect(error.response.body).toEqual('That file is not found')
        }
      })

      test('should not see files outside of the mapped dir', async () => {
        try {
          await request.get(url + '/my/public/route/../../config/servers/web.js')
        } catch (error) {
          expect(error.statusCode).toEqual(404)
          expect(error.response.body).toEqual('That file is not found')
        }
      })
    })

    describe('can serve files from more than one directory', () => {
      let source = path.join(__dirname, '/../../public/simple.html')

      beforeAll(() => {
        fs.createReadStream(source).pipe(fs.createWriteStream(os.tmpdir() + path.sep + 'tmpTestFile.html'))
        api.staticFile.searchLoactions.push(os.tmpdir())
      })

      afterAll(() => {
        fs.unlinkSync(os.tmpdir() + path.sep + 'tmpTestFile.html')
        api.staticFile.searchLoactions.pop()
      })

      test('works for secondary paths', async () => {
        let response = await request.get(url + '/public/tmpTestFile.html', {resolveWithFullResponse: true})
        expect(response.statusCode).toEqual(200)
        expect(response.body).toEqual('<h1>ActionHero</h1>\\nI am a flat file being served to you via the API from ./public/simple.html<br />')
      })
    })

    describe('depth routes', () => {
      beforeAll(() => {
        api.config.servers.web.urlPathForActions = '/craz/y/action/path'
        api.config.servers.web.urlPathForFiles = '/a/b/c'
      })

      afterAll(() => {
        api.config.servers.web.urlPathForActions = 'api'
        api.config.servers.web.urlPathForFiles = 'public'
      })

      test('old action routes stop working', async () => {
        try {
          await request.get(url + '/api/randomNumber')
          throw new Error('should not get here')
        } catch (error) {
          expect(error.statusCode).toEqual(404)
        }
      })

      test('can ask for nested URL actions', async () => {
        let response = await request.get(url + '/craz/y/action/path/randomNumber', {resolveWithFullResponse: true})
        expect(response.statusCode).toEqual(200)
      })

      test('old file routes stop working', async () => {
        try {
          await request.get(url + '/public/simple.html')
          throw new Error('should not get here')
        } catch (error) {
          expect(error.statusCode).toEqual(404)
        }
      })

      test('can ask for nested URL files', async () => {
        let response = await request.get(url + '/a/b/c/simple.html', {resolveWithFullResponse: true})
        expect(response.statusCode).toEqual(200)
        expect(response.body).toEqual('<h1>ActionHero</h1>\\nI am a flat file being served to you via the API from ./public/simple.html<br />')
      })

      test('can ask for nested URL files with depth', async () => {
        let response = await request.get(url + '/a/b/c/css/cosmo.css', {resolveWithFullResponse: true})
        expect(response.statusCode).toEqual(200)
      })
    })
  })

  describe('routes', () => {
    let originalRoutes
    beforeAll(() => {
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

    afterAll(() => {
      api.routes.routes = originalRoutes
      delete api.actions.versions.mimeTestAction
      delete api.actions.actions.mimeTestAction
      delete api.actions.versions.login
      delete api.actions.actions.login
    })

    test(
      'new params will not be allowed in route definitions (an action should do it)',
      () => {
        expect(api.params.postVariables).not.toContain('bogusID')
      }
    )

    test('\'all\' routes are duplicated properly', () => {
      api.routes.registerRoute('all', '/other-login', 'login')
      let loaded = {}
      let registered = {}
      api.routes.verbs.forEach((verb) => {
        api.routes.routes[verb].forEach((route) => {
          if (!loaded[verb]) loaded[verb] = route.action === 'user' && route.path === '/user/:userID'
          if (!registered[verb]) registered[verb] = route.action === 'login' && route.path === '/other-login'
        })
      })
      expect(Object.keys(loaded).length).toEqual(api.routes.verbs.length)
      expect(Object.keys(registered).length).toEqual(api.routes.verbs.length)
    })

    test('unknown actions are still unknown', async () => {
      try {
        await request.get(url + '/api/a_crazy_action')
        throw new Error('should not get here')
      } catch (error) {
        expect(error.statusCode).toEqual(404)
        let body = await toJson(error.response.body)
        expect(body.error).toEqual('unknown action or invalid apiVersion')
      }
    })

    test(
      'explicit action declarations still override routed actions, if the defined action is real',
      async () => {
        let body = await request.get(url + '/api/user/123?action=randomNumber').then(toJson)
        expect(body.requesterInformation.receivedParams.action).toEqual('randomNumber')
      }
    )

    test(
      'route actions will override explicit actions, if the defined action is null',
      async () => {
        try {
          await request.get(url + '/api/user/123?action=someFakeAction').then(toJson)
          throw new Error('should not get here')
        } catch (error) {
          expect(error.statusCode).toEqual(404)
          let body = await toJson(error.response.body)
          expect(body.requesterInformation.receivedParams.action).toEqual('user')
        }
      }
    )

    test(
      'returns application/json when the mime type cannot be determined for an action',
      async () => {
        let response = await request.get(url + '/api/mimeTestAction/thing.bogus', {resolveWithFullResponse: true})
        expect(response.headers['content-type']).toMatch(/json/)
        let body = JSON.parse(response.body)
        expect(body.matchedRoute.path).toEqual('/mimeTestAction/:key')
        expect(body.matchedRoute.action).toEqual('mimeTestAction')
      }
    )

    test(
      'route actions have the matched route availalbe to the action',
      async () => {
        let body = await request.get(url + '/api/mimeTestAction/thing.json').then(toJson)
        expect(body.matchedRoute.path).toEqual('/mimeTestAction/:key')
        expect(body.matchedRoute.action).toEqual('mimeTestAction')
      }
    )

    test('Routes should recognize apiVersion as default param', async () => {
      let body = await request.get(url + '/api/old_login?user_id=7').then(toJson)
      expect(body.user_id).toEqual('7')
      expect(body.requesterInformation.receivedParams.action).toEqual('login')
    })

    test('Routes should be mapped for GET (simple)', async () => {
      try {
        await request.get(url + '/api/users').then(toJson)
        throw new Error('should not get here')
      } catch (error) {
        expect(error.statusCode).toEqual(404)
        let body = await toJson(error.response.body)
        expect(body.requesterInformation.receivedParams.action).toEqual('usersList')
      }
    })

    test('Routes should be mapped for GET (complex)', async () => {
      try {
        await request.get(url + '/api/user/1234').then(toJson)
        throw new Error('should not get here')
      } catch (error) {
        expect(error.statusCode).toEqual(404)
        let body = await toJson(error.response.body)
        expect(body.requesterInformation.receivedParams.action).toEqual('user')
        expect(body.requesterInformation.receivedParams.userID).toEqual('1234')
      }
    })

    test('Routes should be mapped for POST', async () => {
      try {
        await request.post(url + '/api/user/1234?key=value').then(toJson)
        throw new Error('should not get here')
      } catch (error) {
        expect(error.statusCode).toEqual(404)
        let body = await toJson(error.response.body)
        expect(body.requesterInformation.receivedParams.action).toEqual('user')
        expect(body.requesterInformation.receivedParams.userID).toEqual('1234')
        expect(body.requesterInformation.receivedParams.key).toEqual('value')
      }
    })

    test('Routes should be mapped for PUT', async () => {
      try {
        await request.put(url + '/api/user/1234?key=value').then(toJson)
        throw new Error('should not get here')
      } catch (error) {
        expect(error.statusCode).toEqual(404)
        let body = await toJson(error.response.body)
        expect(body.requesterInformation.receivedParams.action).toEqual('user')
        expect(body.requesterInformation.receivedParams.userID).toEqual('1234')
        expect(body.requesterInformation.receivedParams.key).toEqual('value')
      }
    })

    test('Routes should be mapped for DELETE', async () => {
      try {
        await request.del(url + '/api/user/1234?key=value').then(toJson)
        throw new Error('should not get here')
      } catch (error) {
        expect(error.statusCode).toEqual(404)
        let body = await toJson(error.response.body)
        expect(body.requesterInformation.receivedParams.action).toEqual('user')
        expect(body.requesterInformation.receivedParams.userID).toEqual('1234')
        expect(body.requesterInformation.receivedParams.key).toEqual('value')
      }
    })

    test('route params trump explicit params', async () => {
      try {
        await request.get(url + '/api/user/1?userID=2').then(toJson)
        throw new Error('should not get here')
      } catch (error) {
        expect(error.statusCode).toEqual(404)
        let body = await toJson(error.response.body)
        expect(body.requesterInformation.receivedParams.action).toEqual('user')
        expect(body.requesterInformation.receivedParams.userID).toEqual('1')
      }
    })

    test('to match, a route much match all parts of the URL', async () => {
      try {
        await request.get(url + '/api/thing').then(toJson)
        throw new Error('should not get here')
      } catch (error) {
        expect(error.statusCode).toEqual(404)
        let body = await toJson(error.response.body)
        expect(body.requesterInformation.receivedParams.action).toEqual('thing')
      }

      try {
        await request.get(url + '/api/thing/stuff').then(toJson)
        throw new Error('should not get here')
      } catch (error) {
        expect(error.statusCode).toEqual(404)
        let body = await toJson(error.response.body)
        expect(body.requesterInformation.receivedParams.action).toEqual('thingStuff')
      }
    })

    test('regexp matches will provide proper variables', async () => {
      let body = await request.post(url + '/api/login/123').then(toJson)
      expect(body.requesterInformation.receivedParams.action).toEqual('login')
      expect(body.requesterInformation.receivedParams.userID).toEqual('123')

      let bodyAgain = await request.post(url + '/api/login/admin').then(toJson)
      expect(bodyAgain.requesterInformation.receivedParams.action).toEqual('login')
      expect(bodyAgain.requesterInformation.receivedParams.userID).toEqual('admin')
    })

    test(
      'regexp matches will still work with params with periods and other wacky chars',
      async () => {
        let body = await request.get(url + '/api/c/key/log_me-in.com$123.').then(toJson)
        expect(body.requesterInformation.receivedParams.action).toEqual('cacheTest')
        expect(body.requesterInformation.receivedParams.value).toEqual('log_me-in.com$123.')
      }
    )

    test('regexp match failures will be rejected', async () => {
      try {
        await request.get(url + '/api/login/1234').then(toJson)
        throw new Error('should not get here')
      } catch (error) {
        expect(error.statusCode).toEqual(404)
        let body = await toJson(error.response.body)
        expect(body.error).toEqual('unknown action or invalid apiVersion')
        expect(body.requesterInformation.receivedParams.userID).toBeUndefined()
      }
    })

    describe('file extensions + routes', () => {
      test(
        'will change header information based on extension (when active)',
        async () => {
          let response = await request.get(url + '/api/mimeTestAction/val.png', {resolveWithFullResponse: true})
          expect(response.headers['content-type']).toEqual('image/png')
        }
      )

      test(
        'will not change header information if there is a connection.error',
        async () => {
          try {
            await request.get(url + '/api/mimeTestAction')
            throw new Error('should not get here')
          } catch (error) {
            expect(error.statusCode).toEqual(422)
            let body = await toJson(error.response.body)
            expect(error.response.headers['content-type']).toEqual('application/json; charset=utf-8')
            expect(body.error).toEqual('key is a required parameter for this action')
          }
        }
      )

      test('works with with matchTrailingPathParts', async () => {
        let body = await request.get(url + '/api/a/wild/theKey/and/some/more/path').then(toJson)
        expect(body.requesterInformation.receivedParams.action).toEqual('mimeTestAction')
        expect(body.requesterInformation.receivedParams.path).toEqual('and/some/more/path')
        expect(body.requesterInformation.receivedParams.key).toEqual('theKey')
      })
    })

    describe('spaces in URL with public files', () => {
      let source = path.join(__dirname, '/../../public/logo/actionhero.png')

      beforeAll(async () => {
        let tmpDir = os.tmpdir()
        let readStream = fs.createReadStream(source)
        api.staticFile.searchLoactions.push(tmpDir)

        await new Promise((resolve) => {
          readStream.pipe(fs.createWriteStream(tmpDir + path.sep + 'actionhero with space.png'))
          readStream.on('close', resolve)
        })
      })

      afterAll(() => {
        fs.unlinkSync(os.tmpdir() + path.sep + 'actionhero with space.png')
        api.staticFile.searchLoactions.pop()
      })

      test(
        'will decode %20 or plus sign to a space so that file system can read',
        async () => {
          let response = await request.get(url + '/actionhero%20with%20space.png', {resolveWithFullResponse: true})
          expect(response.statusCode).toEqual(200)
          expect(response.body).toMatch(/PNG/)
          expect(response.headers['content-type']).toEqual('image/png')
        }
      )

      test('will capture bad encoding in URL and return NOT FOUND', async () => {
        try {
          await request.get(url + '/actionhero%20%%%%%%%%%%with+space.png')
          throw new Error('should not get here')
        } catch (error) {
          expect(error.statusCode).toEqual(404)
          expect(typeof error.response.body).toEqual('string')
          expect(error.response.body).toMatch(/^That file is not found/)
        }
      })
    })
  })

  describe('custom methods', () => {
    let originalRoutes

    beforeAll(() => {
      originalRoutes = api.routes.routes
      api.actions.versions.proxyHeaders = [1]
      api.actions.actions.proxyHeaders = {
        '1': {
          name: 'proxyHeaders',
          description: 'proxy header test',
          inputs: {},
          outputExample: {},
          run: (data) => {
            data.connection.setHeader('X-Foo', 'bar')
          }
        }
      }

      api.actions.versions.proxyStatusCode = [1]
      api.actions.actions.proxyStatusCode = {
        '1': {
          name: 'proxyStatusCode',
          description: 'proxy status code test',
          inputs: {
            code: {
              required: true,
              default: 200,
              formatter: (p) => { return parseInt(p) }
            }
          },
          outputExample: {},
          run: (data) => {
            data.connection.setStatusCode(data.params.code)
          }
        }
      }

      api.actions.versions.pipe = [1]
      api.actions.actions.pipe = {
        '1': {
          name: 'pipe',
          description: 'pipe response test',
          inputs: {
            mode: { required: true }
          },
          outputExample: {},
          run: (data) => {
            data.toRender = false
            if (data.params.mode === 'string') {
              data.connection.pipe('a string', {'custom-header': 'cool'})
            } else if (data.params.mode === 'buffer') {
              data.connection.pipe(Buffer.from('a buffer'), {'custom-header': 'still-cool'})
            } else if (data.params.mode === 'contentType') {
              data.connection.pipe('just some good, old-fashioned words', {'Content-Type': 'text/plain', 'custom-header': 'words'})
            } else {
              throw new Error('I Do not know this mode')
            }
          }
        }
      }

      api.routes.loadRoutes({
        get: [
          {path: '/proxy', action: 'proxyHeaders', apiVersion: 1},
          {path: '/code', action: 'proxyStatusCode', apiVersion: 1},
          {path: '/pipe', action: 'pipe', apiVersion: 1}
        ]
      })
    })

    afterAll(() => {
      api.routes.routes = originalRoutes
      delete api.actions.versions.proxyHeaders
      delete api.actions.versions.proxyStatusCode
      delete api.actions.versions.pipe
      delete api.actions.actions.proxyHeaders
      delete api.actions.actions.proxyStatusCode
      delete api.actions.actions.pipe
    })

    test(
      'actions handled by the web server support proxy for setHeaders',
      async () => {
        let response = await request.get(url + '/api/proxy', {resolveWithFullResponse: true})
        expect(response.headers['x-foo']).toEqual('bar')
      }
    )

    test(
      'actions handled by the web server support proxy for setting status code',
      async () => {
        let responseDefault = await request.get(url + '/api/proxyStatusCode', {resolveWithFullResponse: true})
        expect(responseDefault.statusCode).toEqual(200)

        try {
          await request.get(url + '/api/proxyStatusCode?code=404', {resolveWithFullResponse: true})
          throw new Error('should not get here')
        } catch (error) {
          expect(error.toString()).toMatch(/StatusCodeError: 404/)
        }
      }
    )

    test('can pipe string responses with custom headers to clients', async () => {
      let response = await request.get(url + '/api/pipe?mode=string', {resolveWithFullResponse: true})
      expect(response.headers['custom-header']).toEqual('cool')
      expect(response.headers['content-length']).toEqual('8')
      expect(response.body).toEqual('a string')
    })

    test('can pipe buffer responses with custom headers to clients', async () => {
      let response = await request.get(url + '/api/pipe?mode=buffer', {resolveWithFullResponse: true})
      expect(response.headers['custom-header']).toEqual('still-cool')
      expect(response.headers['content-length']).toEqual('8')
      expect(response.body).toEqual('a buffer')
    })

    test(
      'can pipe buffer responses with custom content types to clients',
      async () => {
        let {headers, body} = await request.get(url + '/api/pipe?mode=contentType', {resolveWithFullResponse: true})
        expect(headers['content-type']).toEqual('text/plain')
        expect(headers['content-length']).toEqual('35')
        expect(headers['custom-header']).toEqual('words')
        expect(body).toEqual('just some good, old-fashioned words')
      }
    )
  })
})
