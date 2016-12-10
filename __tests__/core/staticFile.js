'use strict'

var should = require('should')
let path = require('path')
var ActionheroPrototype = require(path.join(__dirname, '/../../actionhero.js'))
var actionhero = new ActionheroPrototype()
var request = require('request')
var api
var url

describe('Core: Static File', function () {
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
      response.mime.should.equal('text/html')
      response.content.should.equal('<h1>ActionHero</h1>\\nI am a flat file being served to you via the API from ./public/simple.html<br />')
      done()
    })
  })

  it('file: 404 pages', (done) => {
    api.specHelper.getStaticFile('someRandomFile', (response) => {
      response.error.should.equal('That file is not found')
      should.not.exist(response.content)
      done()
    })
  })

  it('I should not see files outside of the public dir', (done) => {
    api.specHelper.getStaticFile('../config/config.json', (response) => {
      response.error.should.equal('That file is not found')
      should.not.exist(response.content)
      done()
    })
  })

  it('file: sub paths should work', (done) => {
    api.specHelper.getStaticFile('logo/actionhero.png', (response) => {
      response.mime.should.equal('image/png')
      response.length.should.equal(142141)
      response.content.length.should.be.within(136836, 137500) // wacky per-OS encoding issues I guess
      done()
    })
  })

  it('should send back the cache-control header', (done) => {
    request.get(url + '/simple.html', (error, response, body) => {
      expect(error).toBeNull()
      response.statusCode.should.eql(200)
      response.headers['cache-control'].should.be.ok
      done()
    })
  })

  it('should send back the etag header', (done) => {
    request.get(url + '/simple.html', (error, response, body) => {
      expect(error).toBeNull()
      response.statusCode.should.eql(200)
      response.headers['etag'].should.be.ok
      done()
    })
  })

  it('should send back a 304 if the header "if-modified-since" is present and condition matches', (done) => {
    request.get(url + '/simple.html', (error, response, body) => {
      expect(error).toBeNull()
      response.statusCode.should.eql(200)
      request({url: url + '/simple.html', headers: {'If-Modified-Since': new Date().toUTCString()}}, function (errBis, responseBis, body) {
        responseBis.statusCode.should.eql(304)
        done()
      })
    })
  })

  it('should send back a 304 if the ETAG header is present', (done) => {
    request.get(url + '/simple.html', function (error, response) {
      expect(error).toBeNull()
      response.statusCode.should.equal(200)
      response.body.should.equal('<h1>ActionHero</h1>\\nI am a flat file being served to you via the API from ./public/simple.html<br />')
      should.exist(response.headers['etag'])
      var etag = response.headers['etag']
      var options = {
        url: url + '/simple.html',
        headers: {
          'If-None-Match': etag
        },
        method: 'get'
      }
      request(options, function (error, response) {
        expect(error).toBeNull()
        response.statusCode.should.equal(304)
        response.body.should.equal('')
        done()
      })
    })
  })

  it('should send a different etag for other files', (done) => {
    request.get(url + '/simple.html', function (error, response) {
      expect(error).toBeNull()
      response.statusCode.should.equal(200)
      should.exist(response.headers['etag'])
      var etagSimple = response.headers['etag']
      request.get(url + '/index.html', function (error, response) {
        expect(error).toBeNull()
        response.statusCode.should.equal(200)
        should.exist(response.headers['etag'])
        var etagIndex = response.headers['etag']
        should.notEqual(etagIndex, etagSimple)
        done()
      })
    })
  })

  it('should send back the file if the header "if-modified-since" is present but condition does not match', (done) => {
    request.get(url + '/simple.html', (error, response, body) => {
      expect(error).toBeNull()
      response.statusCode.should.eql(200)
      var lastModified = new Date(response.headers['last-modified'])
      request({url: url + '/simple.html', headers: {'If-Modified-Since': new Date(lastModified.getTime() - 24 * 1000 * 3600).toUTCString()}}, function (errBis, responseBis, body) {
        responseBis.statusCode.should.eql(200)
        done()
      })
    })
  })

  describe('Core: Static File -> Compression Tests', function () {
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

    it('should find the compression configuration in servers web config', (done) => {
      serverCompressionState.should.be.a.Boolean()
      done()
    })

    it('should respect accept-encoding header priority with gzip as first in a list of encodings', (done) => {
      request.get({url: url + '/simple.html', headers: {'Accept-Encoding': 'gzip, deflate, sdch, br'}}, (error, response, body) => {
        expect(error).toBeNull()
        response.statusCode.should.eql(200)
        response.headers['content-encoding'].should.equal('gzip')
        done()
      })
    })

    it('should respect accept-encoding header priority with deflate as second in a list of encodings', (done) => {
      request.get({url: url + '/simple.html', headers: {'Accept-Encoding': 'br, deflate, gzip'}}, (error, response, body) => {
        expect(error).toBeNull()
        response.statusCode.should.eql(200)
        response.headers['content-encoding'].should.equal('deflate') // br is not a currently supported encoding
        done()
      })
    })

    it('should respect accept-encoding header priority with gzip as only option', (done) => {
      request.get({url: url + '/simple.html', headers: {'Accept-Encoding': 'gzip'}}, (error, response, body) => {
        expect(error).toBeNull()
        response.statusCode.should.eql(200)
        response.headers['content-encoding'].should.equal('gzip')
        done()
      })
    })

    it('should\'nt encode content without a valid a supported value in accept-encoding header', (done) => {
      request.get({url: url + '/simple.html', headers: {'Accept-Encoding': 'sdch, br'}}, (error, response, body) => {
        expect(error).toBeNull()
        response.statusCode.should.eql(200)
        should.not.exist(response.headers['content-encoding'])
        done()
      })
    })

    it('should\'nt encode content without accept-encoding header', (done) => {
      request.get({url: url + '/simple.html'}, (error, response, body) => {
        expect(error).toBeNull()
        response.statusCode.should.eql(200)
        should.not.exist(response.headers['content-encoding'])
        done()
      })
    })
  })
})
