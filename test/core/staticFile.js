var should = require('should');
var request = require('request');
var actionheroPrototype = require(__dirname + '/../../actionhero.js').actionheroPrototype;
var actionhero = new actionheroPrototype();
var api;
var url;

describe('Core: Static File', function(){

  before(function(done){
    actionhero.start(function(err, a){
      api = a;
      url = 'http://localhost:' + api.config.servers.web.port+'/'+api.config.servers.web.urlPathForFiles;
      done();
    })
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
      response.error.should.equal( api.config.errors.fileNotFound() );
      should.not.exist(response.content);
      done();
    });
  });

  it('I should not see files outside of the public dir', function(done){
    api.specHelper.getStaticFile('../config/config.json', function(response){
      response.error.should.equal( api.config.errors.fileNotFound() );
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

  it('should send back the last modified time', function (done) {
    request.get(url+'/simple.html', function (err, response, body) {
      response.statusCode.should.eql(200);
      response.headers['last-modified'].should.be.ok;
      done();
    });
  });

  it('should send back a 304 if the header "if-modified-since" is present and condition matches', function (done) {
    request.get(url+'/simple.html', function (err, response, body) {
      response.statusCode.should.eql(200);
      request({url:url+'/simple.html',headers:{'If-Modified-Since':new Date(Date.now())}}, function (errBis, responseBis, body) {
        responseBis.statusCode.should.eql(304);
        done();
      });
    });
  });

  it('should send back the file if the header "if-modified-since" is present but condition does not match', function (done) {
    request.get(url+'/simple.html', function (err, response, body) {
      response.statusCode.should.eql(200);
      var lastModified=new Date(response.headers['last-modified']);
      request({url:url+'/simple.html',headers:{'If-Modified-Since':new Date(lastModified.getTime()-24*1000*3600)}}, function (errBis, responseBis, body) {
        responseBis.statusCode.should.eql(200);
        done();
      });
    });
  });

});
