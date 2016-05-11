var should              = require('should');
var request             = require('request');
var EventEmitter        = require('events').EventEmitter;
var actionheroPrototype = require(__dirname + '/../../actionhero.js').actionheroPrototype;
var actionhero          = new actionheroPrototype();
var api;

var clientA;
var clientB;
var clientC;

var url;

var connectClients = function(callback){
  // get actionheroClient in scope
  // TODO: Perhaps we read this from disk after server boot.
  eval(api.servers.servers.websocket.compileActionheroClientJS());

  var S = api.servers.servers.websocket.server.Socket;
  var url = 'http://localhost:' + api.config.servers.web.port;
  var clientAsocket = new S(url);
  var clientBsocket = new S(url);
  var clientCsocket = new S(url);

  clientA = new ActionheroClient({}, clientAsocket);
  clientB = new ActionheroClient({}, clientBsocket);
  clientC = new ActionheroClient({}, clientCsocket);

  setTimeout(function(){
    callback();
  }, 100);
};

describe('Server: Web Socket', function(){

  before(function(done){
    actionhero.start(function(error, a){
      api = a;
      url = 'http://localhost:' + api.config.servers.web.port;
      api.config.servers.websocket.clientUrl = 'http://localhost:' + api.config.servers.web.port;

      connectClients(function(){
        done();
      });
    });
  });

  after(function(done){
    actionhero.stop(function(){
      done();
    });
  });

  describe('fingerprint', function(){
    var cookieHeader;
    var oldRequest;

    beforeEach(function(done){
      try{
        clientA.disconnect();
      }catch(e){
      }
      cookieHeader = '';
      connectClients(done);
    });

    before(function(done){
      // Override http.request to test fingerprint
      var module = require('http');
      oldRequest = module.request;
      module.request = function(options, callback){
        options.headers.Cookie = cookieHeader;
        return oldRequest.apply(module, arguments);
      };
      done();
    });

    after(function(done){
      // Restore http.request
      var module = require('http');
      module.request = oldRequest;
      done();
    });

    it('should exist when web server been called', function(done){
      request.get(url + '/api/', function(error, response, body){
        body = JSON.parse(body);
        var fingerprint = body.requesterInformation.fingerprint;
        cookieHeader = response.headers['set-cookie'][0];
        clientA.connect(function(error, response){
          response.status.should.equal('OK');
          should(response.data).have.property('id');
          var id = response.data.id;
          api.connections.connections[id].fingerprint.should.equal(fingerprint);
          done();
        });
      });
    });

    it('should not exist when web server has not been called', function(done){
      clientA.connect(function(error, response){
        response.status.should.equal('OK');
        should(response.data).have.property('id');
        var id = response.data.id;
        api.connections.connections[id].should.have.property('fingerprint').which.is['null'];
        done();
      });
    });

    it('should exist as long as cookie is passed', function(done){
      cookieHeader = api.config.servers.web.fingerprintOptions.cookieKey + '=dummyValue';
      clientA.connect(function(error, response){
        response.status.should.equal('OK');
        should(response.data).have.property('id');
        var id = response.data.id;
        api.connections.connections[id].should.have.property('fingerprint').which.is.not['null'];
        done();
      });
    });
  });
});
