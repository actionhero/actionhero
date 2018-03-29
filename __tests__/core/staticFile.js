'use strict'

const path = require('path')
const ActionHero = require(path.join(__dirname, '/../../index.js'))
const actionhero = new ActionHero.Process()
const request = require('request-promise-native')
let api
let url

describe('Core', () => {
  describe('static file', () => {
    beforeAll(async () => {
      api = await actionhero.start()
      url = 'http://localhost:' + api.config.servers.web.port + '/' + api.config.servers.web.urlPathForFiles
    })

    afterAll(async () => { await actionhero.stop() })

    test('file: an HTML file', async () => {
      let response = await api.specHelper.getStaticFile('simple.html')
      expect(response.mime).toEqual('text/html')
      expect(response.content).toEqual('<h1>ActionHero</h1>\\nI am a flat file being served to you via the API from ./public/simple.html<br />')
    })

    test('file: 404 pages', async () => {
      let response = await api.specHelper.getStaticFile('someRandomFile')
      expect(response.error).toEqual('That file is not found')
      expect(response.content).toBeNull()
    })

    test('I should not see files outside of the public dir', async () => {
      let response = await api.specHelper.getStaticFile('../config/config.json')
      expect(response.error).toEqual('That file is not found')
      expect(response.content).toBeNull()
    })

    test('file: sub paths should work', async () => {
      let response = await api.specHelper.getStaticFile('logo/actionhero.png')
      expect(response.mime).toEqual('image/png')
      expect(response.length).toEqual(59273)
      // wacky per-OS encoding issues I guess?
      expect(response.content.length).toBeGreaterThanOrEqual(50000)
      expect(response.content.length).toBeLessThan(60000)
    })

    test('should send back the cache-control header', async () => {
      let response = await request.get(url + '/simple.html', {resolveWithFullResponse: true})
      expect(response.statusCode).toEqual(200)
      expect(response.headers['cache-control']).toBeTruthy()
    })

    test('should send back the etag header', async () => {
      let response = await request.get(url + '/simple.html', {resolveWithFullResponse: true})
      expect(response.statusCode).toEqual(200)
      expect(response.headers['etag']).toBeTruthy()
    })

    test(
      'should send back a 304 if the header "if-modified-since" is present and condition matches',
      async () => {
        let response = await request.get(url + '/simple.html', {resolveWithFullResponse: true})
        expect(response.statusCode).toEqual(200)

        try {
          await request(url + '/simple.html', {
            headers: { 'If-Modified-Since': new Date().toUTCString() },
            resolveWithFullResponse: true
          })
          throw new Error('should not get here')
        } catch (error) {
          expect(error.toString()).toMatch(/304/)
        }
      }
    )

    test('should send back a 304 if the ETAG header is present', async () => {
      let response = await request.get(url + '/simple.html', {resolveWithFullResponse: true})
      expect(response.statusCode).toEqual(200)
      expect(response.body).toEqual('<h1>ActionHero</h1>\\nI am a flat file being served to you via the API from ./public/simple.html<br />')
      expect(response.headers['etag']).toBeTruthy()

      let etag = response.headers['etag']
      let options = {
        headers: { 'If-None-Match': etag },
        resolveWithFullResponse: true
      }

      try {
        await request(url + '/simple.html', options)
        throw new Error('should not get here')
      } catch (error) {
        expect(error.toString()).toMatch(/304/)
      }
    })

    test('should send a different etag for other files', async () => {
      let response = await request.get(url + '/simple.html', {resolveWithFullResponse: true})
      expect(response.statusCode).toEqual(200)
      expect(response.headers['etag']).toBeTruthy()
      let etag = response.headers['etag']

      let secondResponse = await request.get(url + '/index.html', {resolveWithFullResponse: true})
      expect(secondResponse.statusCode).toEqual(200)
      expect(secondResponse.headers['etag']).toBeTruthy()
      let etagTwo = secondResponse.headers['etag']
      expect(etagTwo).not.toEqual(etag)
    })

    test(
      'should send back the file if the header "if-modified-since" is present but condition does not match',
      async () => {
        let response = await request.get(url + '/simple.html', {resolveWithFullResponse: true})
        expect(response.statusCode).toEqual(200)
        let lastModified = new Date(response.headers['last-modified'])
        let delay = 24 * 1000 * 3600

        let secondResponse = await request(url + '/simple.html', {
          headers: {'If-Modified-Since': new Date(lastModified.getTime() - delay).toUTCString()},
          resolveWithFullResponse: true
        })

        expect(secondResponse.statusCode).toEqual(200)
        expect(secondResponse.body.length).toBeGreaterThan(1)
      }
    )

    describe('Compression', () => {
      let serverCompressionState
      beforeAll(() => {
        serverCompressionState = api.config.servers.web.compress
        api.config.servers.web.compress = true // activate compression, default is likely to be false
      })

      afterAll(() => {
        api.config.servers.web.compress = serverCompressionState
      })

      test(
        'should respect accept-encoding header priority with gzip as first in a list of encodings',
        async () => {
          let response = await request.get(url + '/simple.html', {
            headers: {'Accept-Encoding': 'gzip, deflate, sdch, br'},
            resolveWithFullResponse: true
          })

          expect(response.statusCode).toEqual(200)
          expect(response.headers['content-encoding']).toEqual('gzip')
        }
      )

      test(
        'should respect accept-encoding header priority with deflate as second in a list of encodings',
        async () => {
          let response = await request.get(url + '/simple.html', {
            headers: {'Accept-Encoding': 'br, deflate, gzip'},
            resolveWithFullResponse: true
          })

          expect(response.statusCode).toEqual(200)
          expect(response.headers['content-encoding']).toEqual('deflate') // br is not a currently supported encoding
        }
      )

      test(
        'should respect accept-encoding header priority with gzip as only option',
        async () => {
          let response = await request.get(url + '/simple.html', {
            headers: {'Accept-Encoding': 'gzip'},
            resolveWithFullResponse: true
          })

          expect(response.statusCode).toEqual(200)
          expect(response.headers['content-encoding']).toEqual('gzip')
        }
      )

      test(
        'should not encode content without a valid a supported value in accept-encoding header',
        async () => {
          let response = await request.get(url + '/simple.html', {
            headers: {'Accept-Encoding': 'sdch, br'},
            resolveWithFullResponse: true
          })

          expect(response.statusCode).toEqual(200)
          expect(response.headers['content-encoding']).toBeUndefined()
        }
      )

      test('should not encode content without accept-encoding header', async () => {
        let response = await request.get(url + '/simple.html', {
          resolveWithFullResponse: true
        })

        expect(response.statusCode).toEqual(200)
        expect(response.headers['content-encoding']).toBeUndefined()
      })
    })
  })
})
