describe('Client: Socket', function(){
  var specHelper = require('../helpers/specHelper.js').specHelper;
  var net = require('net');
  var apiObj = {};
  var rawAPI = {};
  var should = require("should");
  var client_details = {};
  var client_2_details = {};

  var client = {};
  var client2 = {};
  var client3 = {};

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
    specHelper.prepare(0, function(api){ 
      rawAPI = api;
      apiObj = specHelper.cleanAPIObject(api);
      done();
    })
  });

  after(function(done){
    client.write("quit\r\n")
    client2.write("quit\r\n")
    client3.write("quit\r\n")
    done();
  });

  it('should connect all 3 clients', function(done){
    client = net.connect(specHelper.params[0].tcpServer.port, function(){
      client.setEncoding('utf8');
      client2 = net.connect(specHelper.params[0].tcpServer.port, function(){
        client2.setEncoding('utf8');
        client3 = net.connect(specHelper.params[0].tcpServer.port, function(){
          client3.setEncoding('utf8');
          setTimeout(function(){ // This timeout is to wait-out all the 
            client.should.be.an.instanceOf(Object)
            client2.should.be.an.instanceOf(Object)
            client3.should.be.an.instanceOf(Object)
            done();
          }, 1000);
        });
      }); 
    }); 
  });

  it('socket connections should be able to connect and get JSON', function(done){
    makeSocketRequest(client, "hello", function(response){
      response.should.be.an.instanceOf(Object)
      response.error.should.equal("Error: hello is not a known action.");
      done();
    });
  });

  it('single string message are treated as actions', function(done){
    makeSocketRequest(client, "status", function(response){
      response.should.be.an.instanceOf(Object)
      response.stats.local['connections:activeConnections:socket'].should.equal(3)
      done();
    });
  });

  it('stringified JSON can also be sent as actions', function(done){
    makeSocketRequest(client, JSON.stringify({action: 'status', params: {something: 'else'}}), function(response){
      response.should.be.an.instanceOf(Object)
      response.stats.local['connections:activeConnections:socket'].should.equal(3)
      done();
    });
  });

  it('really long messages are OK', function(done){
    var msg = {
      action: 'cacheTest',
      params: {
        key: apiObj.utils.randomString(16384),
        value: apiObj.utils.randomString(16384)
      }
    }
    makeSocketRequest(client, JSON.stringify(msg), function(response){
      response.cacheTestResults.loadResp.key.should.eql("cacheTest_"+msg.params.key);
      response.cacheTestResults.loadResp.value.should.eql(msg.params.value);
      done();
    });
  });

  it('I can get my details', function(done){
    makeSocketRequest(client2, "detailsView", function(response){
      response.status.should.equal("OK")
      response.details.params.should.be.an.instanceOf(Object)
      response.details.should.be.an.instanceOf(Object)
      response.details.connectedAt.should.be.within(0, new Date().getTime())
      client_2_details = response.details; // save for later!
      done();
    });
  });

  it('default parmas are set', function(done){
    makeSocketRequest(client, "paramsView", function(response){
      response.should.be.an.instanceOf(Object)
      response.params.limit.should.equal(100)
      response.params.offset.should.equal(0)
      done();
    });
  });

  it('params can be updated', function(done){
    makeSocketRequest(client, "paramAdd limit=50", function(response){
      response.status.should.equal('OK');
      makeSocketRequest(client, "paramsView", function(response){
        response.params.limit.should.equal(String(50))
        done();
      });
    });
  });

  it('actions will fail without proper parmas set to the connection', function(done){
    makeSocketRequest(client, "cacheTest", function(response){
      response.error.should.equal('Error: key is a required parameter for this action')
      done();
    });
  });

  it('a new param can be added', function(done){
    makeSocketRequest(client, "paramAdd key=socketTestKey", function(response){
      response.status.should.equal('OK');
      done();
    });
  });

  it('a new param can be viewed once added', function(done){
    makeSocketRequest(client, "paramView key", function(response){
      response.params.key.should.equal("socketTestKey")
      done();
    });
  });


  it('another new param can be added', function(done){
    makeSocketRequest(client, "paramAdd value=abc123", function(response){
      response.status.should.equal('OK');
      done();
    });
  });

  it('actions will work once all the needed params are added', function(done){
    makeSocketRequest(client, "cacheTest", function(response){
      response.cacheTestResults.saveResp.should.equal(true);
      done();
    });
  });

  it('only params sent in a JSON block are used', function(done){
    makeSocketRequest(client, JSON.stringify({action: 'cacheTest', params: {key: 'someOtherValue'}}), function(response){
      response.error.should.equal("Error: value is a required parameter for this action")
      done();
    });
  });

  it('will limit how many simultanious connections I can have', function(done){
    this.timeout(5000)
    client.write(JSON.stringify({action: 'sleepTest', params: {sleepDuration: 500}}) + "\r\n");
    client.write(JSON.stringify({action: 'sleepTest', params: {sleepDuration: 600}}) + "\r\n");
    client.write(JSON.stringify({action: 'sleepTest', params: {sleepDuration: 700}}) + "\r\n");
    client.write(JSON.stringify({action: 'sleepTest', params: {sleepDuration: 800}}) + "\r\n");
    client.write(JSON.stringify({action: 'sleepTest', params: {sleepDuration: 900}}) + "\r\n");
    client.write(JSON.stringify({action: 'sleepTest', params: {sleepDuration: 1000}}) + "\r\n");

    var responses = []
    var checkResponses = function(data){
      responses.push(JSON.parse(data));
      if(responses.length == 6){
        for(var i in responses){
          var response = responses[i];
          if(i == 0){
            response.error.should.eql("you have too many pending requests");
          }else{
            should.not.exist(response.error)
          }
        }

        client.removeListener('data', checkResponses);
        done();
      }
    }

    client.on('data', checkResponses);
  });

  it('params sent in a JSON do not stick', function(done){
    makeSocketRequest(client, "paramsView", function(response){
      response.params.key.should.equal('socketTestKey')
      done();
    });
  });

  it('clients start in the default room', function(done){
    makeSocketRequest(client, "roomView", function(response){
      response.room.should.equal(apiObj.configData.general.defaultChatRoom);
      done();
    });
  });

  it('clients can view additional infor about rooms they are in', function(done){
    makeSocketRequest(client, "roomView", function(response){
      response.roomStatus.membersCount.should.equal(3)
      done();
    });
  });

  it('rooms can be changed', function(done){
    makeSocketRequest(client, "roomChange otherRoom", function(response){
      response.status.should.equal("OK")
      makeSocketRequest(client, "roomView", function(response){
        response.room.should.equal('otherRoom');
        done();
      })
    });
  });

  it('connections in the first room see the count go down', function(done){
    makeSocketRequest(client2, "roomView", function(response){
      response.roomStatus.membersCount.should.equal(2)
      done();
    });
  });

  it('folks in my room hear what I say (and say works)', function(done){
  var listener = function(response){
    client3.removeListener('data',listener);
    response = JSON.parse(response);
    response.message.should.equal("hello?");
    done();
  }
  client3.on('data', listener);
  client2.write("say hello?" + "\r\n");
  });

  it('folks NOT in my room DON\'T hear what I say', function(done){
  var listener = function(response){
    client.removeListener('data',listener);
    throw new Error("I shouldn't have gotten this message");
    done();
  };
  client.on('data', listener);
  client2.write("say hello?" + "\r\n");
  setTimeout(function(){
    client.removeListener('data',listener);
    done(); // this is the proper way to pass this test.
  }, 1000)
  });

  it('Folks are notified when I join a room', function(done){
  var listener = function(response){
    client.removeListener('data',listener);
    response = JSON.parse(response);
    response.message.should.equal("I have entered the room");
    response.from.should.equal(client_2_details.id);
    done();
  }
  client.on('data', listener);
  client2.write("roomChange otherRoom" + "\r\n");
  });

  it('Folks are notified when I leave a room', function(done){
  var listener = function(response){
    client.removeListener('data',listener);
    response = JSON.parse(response);
    response.message.should.equal("I have left the room");
    response.from.should.equal(client_2_details.id);
    done();
  }
  client.on('data', listener);
  client2.write("roomChange " + apiObj.configData.general.defaultChatRoo + "\r\n");
  });

  it('I can register for messages from rooms I am not in', function(done){
    this.timeout(5000);
    makeSocketRequest(client, "roomChange room1", function(response){
      makeSocketRequest(client2, "roomChange room2", function(response){
        makeSocketRequest(client, "listenToRoom room2", function(response){
          var listener = function(response){
            client.removeListener('data',listener);
            var message = JSON.parse(response);
            message.message.should.eql("hello in room2")
            done();
          }
          setTimeout(function(){
            client.on('data', listener);
            client2.write("say hello in room2\r\n");
          }, 100);
        });
      });
    });
  });

  it('I can unregister for messages from rooms I am not in', function(done){
    this.timeout(5000);
    makeSocketRequest(client, "roomChange room1", function(response){
      makeSocketRequest(client2, "roomChange room2", function(response){
        makeSocketRequest(client, "listenToRoom room2", function(response){
          makeSocketRequest(client, "silenceRoom room2", function(response){
            var listener = function(response){
              client.removeListener('data',listener);
              throw new Error("I should not have gotten this message: " + response)
              done();
            }
            setTimeout(function(){
              client.on('data', listener);
              client2.write("say hello in room2\r\n");
            }, 100);
            setTimeout(function(){
              client.removeListener('data',listener);
              done(); // yay, I didn't get the message
            }, 2000);
          });
        });
      });
    });
  });

  it('I can get my id', function(done){
    var listener = function(response){
      client.removeListener('data',listener);
      client_details = JSON.parse(response).details;
      done();
    }
    client.on('data', listener);
    client.write("detailsView\r\n");
  });

  it('can send auth\'d messages', function(done){
    rawAPI.connections.connections[client_details.id].auth = 'true';
    client2.write("paramAdd roomMatchKey=auth\r\n");
    client2.write("paramAdd roomMatchValue=true\r\n");
    client2.write("roomChange secretRoom\r\n");
    client.write("roomChange secretRoom\r\n");
    setTimeout(function(){
      var listener = function(response){
        client.removeListener('data',listener);
        response = JSON.parse(response);
        response.message.should.equal("secretAuthTest");
        response.from.should.equal(client_2_details.id);
        done();
      }
      client.on('data', listener);
      client2.write("say secretAuthTest\r\n");
    },500) 
  });

  it('doesn\'t send messages to people who are not authed', function(done){
    rawAPI.connections.connections[client_details.id].auth = 'false';
    client2.write("paramAdd roomMatchKey=auth\r\n");
    client2.write("paramAdd roomMatchValue=true\r\n");
    client2.write("roomChange secretRoom\r\n");
    client.write("roomChange secretRoom\r\n");
    setTimeout(function(){
      var listener = function(response){
        client.removeListener('data',listener);
        throw new Error("should not get the message");
        done();
      }
      client.on('data', listener);
      client2.write("say secretAuthTest\r\n");
      setTimeout(function(){
        client.removeListener('data',listener);
        done(); // should just timeout
      }, 1000)
    },500) 
  });

});