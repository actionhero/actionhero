'use strict'

var chai = require('chai')
var dirtyChai = require('dirty-chai')
var expect = chai.expect
chai.use(dirtyChai)

let path = require('path')
var ActionheroPrototype = require(path.join(__dirname, '/../../actionhero.js'))
var actionhero = new ActionheroPrototype()
var request = require('request')
var api
var url

describe('Core: Static File', () => {
  before((done) => {
    actionhero.start((error, a) => {
      expect(error).to.be.null()
      api = a
      url = 'http://localhost:' + api.config.servers.web.port + '/' + api.config.servers.web.urlPathForFiles
      done()
    })
  })

  after((done) => {
    actionhero.stop(() => {
      done()
    })
  })

  it('file: an HTML file', (done) => {
    api.specHelper.getStaticFile('simple.html', (response) => {
      expect(response.mime).to.equal('text/html')
      expect(response.content).to.equal('<h1>ActionHero</h1>\\nI am a flat file being served to you via the API from ./public/simple.html<br />')
      done()
    })
  })

  it('file: 404 pages', (done) => {
    api.specHelper.getStaticFile('someRandomFile', (response) => {
      expect(response.error).to.equal('That file is not found')
      expect(response.content).to.be.null()
      done()
    })
  })

  it('I should not see files outside of the public dir', (done) => {
    api.specHelper.getStaticFile('../config/config.json', (response) => {
      expect(response.error).to.equal('That file is not found')
      expect(response.content).to.be.null()
      done()
    })
  })

  it('file: sub paths should work', (done) => {
    api.specHelper.getStaticFile('logo/actionhero.png', (response) => {
      expect(response.mime).to.equal('image/png')
      expect(response.length).to.equal(59273)
      // wacky per-OS encoding issues I guess?
      expect(response.content.length).to.be.at.least(50000)
      expect(response.content.length).to.be.at.most(60000)
      done()
    })
  })

  it('should send back the cache-control header', (done) => {
    request.get(url + '/simple.html', (error, response, body) => {
      expect(error).to.be.null()
      expect(response.statusCode).to.equal(200)
      expect(response.headers['cache-control']).to.be.ok()
      done()
    })
  })

  it('should send back the etag header', (done) => {
    request.get(url + '/simple.html', (error, response, body) => {
      expect(error).to.be.null()
      expect(response.statusCode).to.equal(200)
      expect(response.headers['etag']).to.be.ok()
      done()
    })
  })

  it('should send back a 304 if the header "if-modified-since" is present and condition matches', (done) => {
    request.get(url + '/simple.html', (error, response, body) => {
      expect(error).to.be.null()
      expect(response.statusCode).to.equal(200)
      request({url: url + '/simple.html', headers: {'If-Modified-Since': new Date().toUTCString()}}, (errBis, responseBis, body) => {
        expect(responseBis.statusCode).to.equal(304)
        done()
      })
    })
  })

  it('should send back a 304 if the ETAG header is present', (done) => {
    request.get(url + '/simple.html', (error, response) => {
      expect(error).to.be.null()
      expect(response.statusCode).to.equal(200)
      expect(response.body).to.equal('<h1>ActionHero</h1>\\nI am a flat file being served to you via the API from ./public/simple.html<br />')
      expect(response.headers['etag']).to.be.ok()
      var etag = response.headers['etag']
      var options = {
        url: url + '/simple.html',
        headers: {
          'If-None-Match': etag
        },
        method: 'get'
      }
      request(options, (error, response) => {
        expect(error).to.be.null()
        expect(response.statusCode).to.equal(304)
        expect(response.body).to.equal('')
        done()
      })
    })
  })

  it('should send a different etag for other files', (done) => {
    request.get(url + '/simple.html', (error, response) => {
      expect(error).to.be.null()
      expect(response.statusCode).to.equal(200)
      expect(response.headers['etag']).to.be.ok()
      var etagSimple = response.headers['etag']
      request.get(url + '/index.html', (error, response) => {
        expect(error).to.be.null()
        expect(response.statusCode).to.equal(200)
        expect(response.headers['etag']).to.be.ok()
        var etagIndex = response.headers['etag']
        expect(etagIndex).not.to.equal(etagSimple)
        done()
      })
    })
  })

  it('should send back the file if the header "if-modified-since" is present but condition does not match', (done) => {
    request.get(url + '/simple.html', (error, response, body) => {
      expect(error).to.be.null()
      expect(response.statusCode).to.equal(200)
      var lastModified = new Date(response.headers['last-modified'])
      var delay = 24 * 1000 * 3600

      request({
        url: url + '/simple.html',
        headers: {'If-Modified-Since': new Date(lastModified.getTime() - delay).toUTCString()}
      }, (errBis, responseBis, body) => {
        expect(responseBis.statusCode).to.equal(200)
        done()
      })
    })
  })

  describe('Core: Static File -> Compression Tests', () => {
    var serverCompressionState
    before((done) => {
      serverCompressionState = api.config.servers.web.compress
      api.config.servers.web.compress = true // activate compression, default is likely to be false
      done()
    })

    after((done) => {
      api.config.servers.web.compress = serverCompressionState
      done()
    })

    it('should respect accept-encoding header priority with gzip as first in a list of encodings', (done) => {
      request.get({url: url + '/simple.html', headers: {'Accept-Encoding': 'gzip, deflate, sdch, br'}}, (error, response, body) => {
        expect(error).to.be.null()
        expect(response.statusCode).to.equal(200)
        expect(response.headers['content-encoding']).to.equal('gzip')
        done()
      })
    })

    it('should respect accept-encoding header priority with deflate as second in a list of encodings', (done) => {
      request.get({url: url + '/simple.html', headers: {'Accept-Encoding': 'br, deflate, gzip'}}, (error, response, body) => {
        expect(error).to.be.null()
        expect(response.statusCode).to.equal(200)
        expect(response.headers['content-encoding']).to.equal('deflate') // br is not a currently supported encoding
        done()
      })
    })

    it('should respect accept-encoding header priority with gzip as only option', (done) => {
      request.get({url: url + '/simple.html', headers: {'Accept-Encoding': 'gzip'}}, (error, response, body) => {
        expect(error).to.be.null()
        expect(response.statusCode).to.equal(200)
        expect(response.headers['content-encoding']).to.equal('gzip')
        done()
      })
    })

    it('should\'nt encode content without a valid a supported value in accept-encoding header', (done) => {
      request.get({url: url + '/simple.html', headers: {'Accept-Encoding': 'sdch, br'}}, (error, response, body) => {
        expect(error).to.be.null()
        expect(response.statusCode).to.equal(200)
        expect(response.headers['content-encoding']).to.not.exist()
        done()
      })
    })

    it('should\'nt encode content without accept-encoding header', (done) => {
      request.get({url: url + '/simple.html'}, (error, response, body) => {
        expect(error).to.be.null()
        expect(response.statusCode).to.equal(200)
        expect(response.headers['content-encoding']).to.not.exist()
        done()
      })
    })
  })
})
