'use strict'

let path = require('path')
var ActionheroPrototype = require(path.join(__dirname, '/../../actionhero.js'))
var actionhero = new ActionheroPrototype()
var request = require('request')
var api
var url

describe('Core: Static File', () => {
  beforeAll((done) => {
    actionhero.start((error, a) => {
      expect(error).toBeNull()
      api = a
      url = 'http://localhost:' + api.config.servers.web.port + '/' + api.config.servers.web.urlPathForFiles
      done()
    })
  })

  afterAll((done) => {
    actionhero.stop(() => {
      done()
    })
  })

  it('file: an HTML file', (done) => {
    api.specHelper.getStaticFile('simple.html', (response) => {
      expect(response.mime).toBe('text/html')
      expect(response.content).toBe('<h1>ActionHero</h1>\\nI am a flat file being served to you via the API from ./public/simple.html<br />')
      done()
    })
  })

  it('file: 404 pages', (done) => {
    api.specHelper.getStaticFile('someRandomFile', (response) => {
      expect(response.error).toBe('That file is not found')
      expect(response.content).toBeNull()
      done()
    })
  })

  it('I should not see files outside of the public dir', (done) => {
    api.specHelper.getStaticFile('../config/config.json', (response) => {
      expect(response.error).toBe('That file is not found')
      expect(response.content).toBeNull()
      done()
    })
  })

  it('file: sub paths should work', (done) => {
    api.specHelper.getStaticFile('logo/actionhero.png', (response) => {
      expect(response.mime).toBe('image/png')
      expect(response.length).toBe(142141)
      // wacky per-OS encoding issues I guess?
      expect(response.content.length).toBeGreaterThanOrEqual(136836)
      expect(response.content.length).toBeLessThanOrEqual(137500)
      done()
    })
  })

  it('should send back the cache-control header', (done) => {
    request.get(url + '/simple.html', (error, response, body) => {
      expect(error).toBeNull()
      expect(response.statusCode).toBe(200)
      expect(response.headers['cache-control']).toBeTruthy()
      done()
    })
  })

  it('should send back the etag header', (done) => {
    request.get(url + '/simple.html', (error, response, body) => {
      expect(error).toBeNull()
      expect(response.statusCode).toBe(200)
      expect(response.headers['etag']).toBeTruthy()
      done()
    })
  })

  it('should send back a 304 if the header "if-modified-since" is present and condition matches', (done) => {
    request.get(url + '/simple.html', (error, response, body) => {
      expect(error).toBeNull()
      expect(response.statusCode).toBe(200)
      request({url: url + '/simple.html', headers: {'If-Modified-Since': new Date().toUTCString()}}, (errBis, responseBis, body) => {
        expect(responseBis.statusCode).toBe(304)
        done()
      })
    })
  })

  it('should send back a 304 if the ETAG header is present', (done) => {
    request.get(url + '/simple.html', (error, response) => {
      expect(error).toBeNull()
      expect(response.statusCode).toBe(200)
      expect(response.body).toBe('<h1>ActionHero</h1>\\nI am a flat file being served to you via the API from ./public/simple.html<br />')
      expect(response.headers['etag']).toBeTruthy()
      var etag = response.headers['etag']
      var options = {
        url: url + '/simple.html',
        headers: {
          'If-None-Match': etag
        },
        method: 'get'
      }
      request(options, (error, response) => {
        expect(error).toBeNull()
        expect(response.statusCode).toBe(304)
        expect(response.body).toBe('')
        done()
      })
    })
  })

  it('should send a different etag for other files', (done) => {
    request.get(url + '/simple.html', (error, response) => {
      expect(error).toBeNull()
      expect(response.statusCode).toBe(200)
      expect(response.headers['etag']).toBeTruthy()
      var etagSimple = response.headers['etag']
      request.get(url + '/index.html', (error, response) => {
        expect(error).toBeNull()
        expect(response.statusCode).toBe(200)
        expect(response.headers['etag']).toBeTruthy()
        var etagIndex = response.headers['etag']
        expect(etagIndex).not.toBe(etagSimple)
        done()
      })
    })
  })

  it('should send back the file if the header "if-modified-since" is present but condition does not match', (done) => {
    request.get(url + '/simple.html', (error, response, body) => {
      expect(error).toBeNull()
      expect(response.statusCode).toBe(200)
      var lastModified = new Date(response.headers['last-modified'])
      request({url: url + '/simple.html', headers: {'If-Modified-Since': new Date(lastModified.getTime() - 24 * 1000 * 3600).toUTCString()}}, (errBis, responseBis, body) => {
        expect(responseBis.statusCode).toBe(200)
        done()
      })
    })
  })

  describe('Core: Static File -> Compression Tests', () => {
    var serverCompressionState
    beforeAll((done) => {
      serverCompressionState = api.config.servers.web.compress
      api.config.servers.web.compress = true // activate compression, default is likely to be false
      done()
    })

    afterAll((done) => {
      api.config.servers.web.compress = serverCompressionState
      done()
    })

    it('should respect accept-encoding header priority with gzip as first in a list of encodings', (done) => {
      request.get({url: url + '/simple.html', headers: {'Accept-Encoding': 'gzip, deflate, sdch, br'}}, (error, response, body) => {
        expect(error).toBeNull()
        expect(response.statusCode).toBe(200)
        expect(response.headers['content-encoding']).toBe('gzip')
        done()
      })
    })

    it('should respect accept-encoding header priority with deflate as second in a list of encodings', (done) => {
      request.get({url: url + '/simple.html', headers: {'Accept-Encoding': 'br, deflate, gzip'}}, (error, response, body) => {
        expect(error).toBeNull()
        expect(response.statusCode).toBe(200)
        expect(response.headers['content-encoding']).toBe('deflate') // br is not a currently supported encoding
        done()
      })
    })

    it('should respect accept-encoding header priority with gzip as only option', (done) => {
      request.get({url: url + '/simple.html', headers: {'Accept-Encoding': 'gzip'}}, (error, response, body) => {
        expect(error).toBeNull()
        expect(response.statusCode).toBe(200)
        expect(response.headers['content-encoding']).toBe('gzip')
        done()
      })
    })

    it('should\'nt encode content without a valid a supported value in accept-encoding header', (done) => {
      request.get({url: url + '/simple.html', headers: {'Accept-Encoding': 'sdch, br'}}, (error, response, body) => {
        expect(error).toBeNull()
        expect(response.statusCode).toBe(200)
        expect(response.headers['content-encoding']).toBeUndefined()
        done()
      })
    })

    it('should\'nt encode content without accept-encoding header', (done) => {
      request.get({url: url + '/simple.html'}, (error, response, body) => {
        expect(error).toBeNull()
        expect(response.statusCode).toBe(200)
        expect(response.headers['content-encoding']).toBeUndefined()
        done()
      })
    })
  })
})
