var should  = require('should');
var request = require('request');
var fs      = require('fs');
var os      = require('os');
var path    = require('path');
var actionheroPrototype = require(__dirname + '/../../actionhero.js').actionheroPrototype;
var actionhero = new actionheroPrototype();
var api;
var url;

describe('Server: sendBuffer', function() {

  before(function (done) {
    actionhero.start(function (error, a) {
      api = a;
      url = 'http://localhost:' + api.config.servers.web.port;
      done();
    });
  });

  after(function (done) {
    actionhero.stop(function () {
      done();
    });
  });

  it('Server should sendBuffer', function (done) {
    request.get(url + '/api/sendBufferTest', function (error, response, body) {
      body.should.equal('Example of data buffer');
      done();
    });
  });
});