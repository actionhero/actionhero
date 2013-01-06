describe('Action: status-only-web', function(){
  var specHelper = require('../helpers/_specHelper.js').specHelper;
  var net = require('net');
  var apiObj = {};
  var should = require("should");

  var serverID = 1;
  var client = {};

  function makeSocketRequest(thisClient, message, cb){
    var rsp = function(d){ 
      var lines = d.split("\n");
      var lastLine = lines[(lines.length - 1)];
      if(lastLine == ""){ lastLine = lines[(lines.length - 2)]; }
      var parsed = JSON.parse(lastLine);
      thisClient.removeListener('data', rsp); 
      cb(parsed); 
    };
    thisClient.on('data', rsp);
    thisClient.write(message + "\r\n");
  }

  before(function(done){
    specHelper.prepare(serverID, function(api){ 
      apiObj = specHelper.cleanAPIObject(api);
      setTimeout(function(){
        done();
      }, 250);
    })
  });

  after(function(done){
    client.write("quit\r\n");
    done();
  });  

  it('stats should be returned via web protocol', function(done){
    specHelper.apiTest.get('/status-only-web', serverID, {}, function(response){
      response.statusCode.should.equal(200);      
      response.body.stats.webServer.numberOfGlobalWebRequests.should.be.above(0);
      response.body.stats.socketServer.numberOfGlobalSocketRequests.should.be.above(-1);
      response.body.stats.uptimeSeconds.should.be.above(0);
      response.body.stats.id.length.should.be.above(0);
      done();
    });
  });

  it('connect to socket server', function(done){
    client = net.connect(specHelper.params[serverID].tcpServer.port, function(){
      client.setEncoding('utf8');
      setTimeout(function(){
        done();
      }, 250);
    });
  });
  
  it('error should be returned via socket protocol', function(done){
    makeSocketRequest(client, "status-only-web", function(response){
      response.should.be.an.instanceOf(Object)
      response.error.should.equal("Error: status-only-web does not support socket protocol.");
      done();
    });
  });

});