var should = require('should');
var request = require('request');
var actionheroPrototype = require(__dirname + '/../../actionhero.js').actionheroPrototype;
var actionhero = new actionheroPrototype();
var api;
var url;

describe('Core: Static File', function(){

  before(function(done){
    actionhero.start(function(error, a){
      api = a;
      url = 'http://localhost:' + api.config.servers.web.port + '/' + api.config.servers.web.urlPathForFiles;
      done();
    });
  });

  after(function(done){
    actionhero.stop(function(){
      done();
    });
  });

  it('file: an HTML file', function(done){
    api.specHelper.getStaticFile('simple.html', function(response){
      response.mime.should.equal('text/html');
      response.content.should.equal('<h1>ActionHero</h1>\\nI am a flat file being served to you via the API from ./public/simple.html<br />');
      done();
    });
  });

  it('file: 404 pages', function(done){
    api.specHelper.getStaticFile('someRandomFile', function(response){
      response.error.should.equal('That file is not found (someRandomFile)');
      should.not.exist(response.content);
      done();
    });
  });

  it('I should not see files outside of the public dir', function(done){
    api.specHelper.getStaticFile('../config/config.json', function(response){
      response.error.should.equal('That file is not found (../config/config.json)');
      should.not.exist(response.content);
      done();
    });
  });

  it('file: sub paths should work', function(done){
    api.specHelper.getStaticFile('logo/actionhero.png', function(response){
      response.mime.should.equal('image/png');
      response.length.should.equal(142141);
      response.content.length.should.be.within(136836, 137500); // wacky per-OS encoding issues I guess
      done();
    });
  });

  it('should send back the cache-control header', function(done){
    request.get(url + '/simple.html', function(error, response, body){
      response.statusCode.should.eql(200);
      response.headers['cache-control'].should.be.ok;
      done();
    });
  });

  it('should send back the etag header', function(done){
    request.get(url + '/simple.html', function(error, response, body){
      response.statusCode.should.eql(200);
      response.headers['etag'].should.be.ok;
      done();
    });
  });

  it('should send back a 304 if the header "if-modified-since" is present and condition matches', function(done){
    request.get(url + '/simple.html', function(error, response, body){
      response.statusCode.should.eql(200);
      request({url:url + '/simple.html', headers: {'If-Modified-Since':new Date().toUTCString()}}, function(errBis, responseBis, body){
        responseBis.statusCode.should.eql(304);
        done();
      });
    });
  });

  it('should send back a 304 if the ETAG header is present', function(done){
    request.get(url + '/simple.html', function(error, response){
      response.statusCode.should.equal(200);
      response.body.should.equal('<h1>ActionHero</h1>\\nI am a flat file being served to you via the API from ./public/simple.html<br />');
      should.exist(response.headers['etag']);
      var etag = response.headers['etag'];
      var options = {
        url: url + '/simple.html',
        headers: {
          'If-None-Match': etag
        },
        method: 'get'
      };
      request(options, function(error, response){
        response.statusCode.should.equal(304);
        response.body.should.equal('');
        done();
      });

    });
  });


  it('should send a different etag for other files', function(done){
    request.get(url + '/simple.html', function(error, response){
      response.statusCode.should.equal(200);
      should.exist(response.headers['etag']);
      var etagSimple = response.headers['etag'];
      request.get(url + '/index.html', function(error, response){
        response.statusCode.should.equal(200);
        should.exist(response.headers['etag']);
        var etagIndex = response.headers['etag'];
        should.notEqual(etagIndex, etagSimple);
        done();
      });

    });
  });

  it('should send back the file if the header "if-modified-since" is present but condition does not match', function(done){
    request.get(url + '/simple.html', function(error, response, body){
      response.statusCode.should.eql(200);
      var lastModified = new Date(response.headers['last-modified']);
      request({url:url + '/simple.html', headers:{'If-Modified-Since':new Date(lastModified.getTime() - 24 * 1000 * 3600).toUTCString()}}, function(errBis, responseBis, body){
        responseBis.statusCode.should.eql(200);
        done();
      });
    });
  });

  it('should respect accept-encoding header priority', function(done){
    var serverCompressionState = api.config.servers.web.compress;
    serverCompressionState.should.be.a.Boolean();
    api.config.servers.web.compress = true; //activate compression, default is likely to be false

    request.get({url:url + '/simple.html', headers:{'Accept-Encoding':'gzip, deflate, sdch, br'}}, function(error, response, body){
      response.statusCode.should.eql(200);
      response.headers['content-encoding'].should.equal('gzip');
      request.get({url:url + '/simple.html', headers:{'Accept-Encoding':'br, deflate, gzip'}}, function(error, response, body){
        response.statusCode.should.eql(200);
        response.headers['content-encoding'].should.equal('deflate'); //br is not a currently supported encoding
        request.get({url:url + '/simple.html', headers:{'Accept-Encoding':'gzip'}}, function(error, response, body){
          response.statusCode.should.eql(200);
          response.headers['content-encoding'].should.equal('gzip');
          api.config.servers.web.compress = serverCompressionState; //reset compression configuration to initial value for further tests
          done();
        });
      });
    });
  });

});
