describe('Server: Socket', function(){
  var specHelper = require(__dirname + '/_specHelper.js').specHelper;
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
    var lines = [];

    var rsp = function(d){ 
      d.split("\n").forEach(function(l){
        lines.push(l);
      });
      lines.push()
    };    

    setTimeout(function(){
      var lastLine = lines[(lines.length - 1)];
      if(lastLine == ""){ lastLine = lines[(lines.length - 2)]; }
      try{
        var parsed = JSON.parse(lastLine);
      }catch(e){
        var parsed = null;
      }
      thisClient.removeListener('data', rsp); 
      if(typeof cb == "function"){ cb(parsed); }
    }, 100);

    thisClient.on('data', rsp);
    thisClient.write(message + "\r\n");
  }

  before(function(done){
    this.timeout(5000);
    specHelper.prepare(0, function(api){ 
      rawAPI = api;
      apiObj = specHelper.cleanAPIObject(api);
      
        client = net.connect(specHelper.params[0].servers.socket.port, function(){
          client.setEncoding('utf8');
          client2 = net.connect(specHelper.params[0].servers.socket.port, function(){
            client2.setEncoding('utf8');
            client3 = net.connect(specHelper.params[0].servers.socket.port, function(){
              client3.setEncoding('utf8');
              setTimeout(function(){ // This timeout is to wait-out all the 
                done();
              }, 1000);
            });
          }); 
        }); 

    });
  });

  after(function(done){
    client.write("quit\r\n")
    client2.write("quit\r\n")
    client3.write("quit\r\n")
    done();
  });

  it('socket connections should be able to connect and get JSON', function(done){
    makeSocketRequest(client, "hello", function(response){
      response.should.be.an.instanceOf(Object)
      response.error.should.equal("Error: hello is not a known action or that is not a valid apiVersion.");
      done();
    });
  });

  it('single string message are treated as actions', function(done){
    makeSocketRequest(client, "status", function(response){
      response.should.be.an.instanceOf(Object)
      parseInt(response.stats.local.connections.activeConnections.socket).should.equal(3)
      done();
    });
  });

  it('stringified JSON can also be sent as actions', function(done){
    makeSocketRequest(client, JSON.stringify({action: 'status', params: {something: 'else'}}), function(response){
      response.should.be.an.instanceOf(Object)
      parseInt(response.stats.local.connections.activeConnections.socket).should.equal(3)
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
      response.data.should.be.an.instanceOf(Object)
      response.data.params.should.be.an.instanceOf(Object)
      response.data.connectedAt.should.be.within(10, new Date().getTime())
      client_2_details = response.data; // save for later!
      done();
    });
  });

  it('default parmas are set', function(done){
    makeSocketRequest(client, "paramsView", function(response){
      response.should.be.an.instanceOf(Object)
      response.data.limit.should.equal(100)
      response.data.offset.should.equal(0)
      done();
    });
  });

  it('params can be updated', function(done){
    makeSocketRequest(client, "paramAdd limit=50", function(response){
      response.status.should.equal('OK');
      makeSocketRequest(client, "paramsView", function(response){
        response.data.limit.should.equal(String(50))
        done();
      });
    });
  });

  it('actions will fail without proper parmas set to the connection', function(done){
    makeSocketRequest(client, "paramDelete key", function(response){
      makeSocketRequest(client, "cacheTest", function(response){
        response.error.should.equal('Error: key is a required parameter for this action')
        done();
      });
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
      response.data.should.equal("socketTestKey")
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
      data.split("\n").forEach(function(line){
        if(line.length > 0){
          responses.push(JSON.parse(line));
        }
      })
      if(responses.length == 6){
        client.removeListener('data', checkResponses);
        for(var i in responses){
          var response = responses[i];
          if(i == 0){
            response.error.should.eql("you have too many pending requests");
          }else{
            should.not.exist(response.error)
          }
        }
        done();
      }
    }

    client.on('data', checkResponses);
  });

  it('clients start in the default room', function(done){
    makeSocketRequest(client, "roomView", function(response){
      response.data.room.should.equal(apiObj.configData.general.defaultChatRoom);
      done();
    });
  });

  it('clients can view additional info about rooms they are in', function(done){
    makeSocketRequest(client, "roomView", function(response){
      response.data.membersCount.should.equal(3)
      done();
    });
  });

  it('rooms can be changed', function(done){
    makeSocketRequest(client, "roomChange otherRoom", function(response){
      response.status.should.equal("OK")
      makeSocketRequest(client, "roomView", function(response){
        response.data.room.should.equal('otherRoom');
        done();
      })
    });
  });

  it('connections in the first room see the count go down', function(done){
    makeSocketRequest(client2, "roomView", function(response){
      response.data.room.should.equal(apiObj.configData.general.defaultChatRoom);
      response.data.membersCount.should.equal(2)
      done();
    });
  });

  it('folks in my room hear what I say (and say works)', function(done){
    makeSocketRequest(client3, "", function(response){
      response.message.should.equal("hello?");
      done();
    });
    makeSocketRequest(client2, "say hello?" + "\r\n");
  });

  it('folks NOT in my room DON\'T hear what I say', function(done){
    makeSocketRequest(client, "", function(response){
      should.not.exist(response);
      done();
    });
    makeSocketRequest(client2, "say hello?" + "\r\n");
  });

  it('Folks are notified when I join a room', function(done){
    makeSocketRequest(client, "", function(response){
      response.message.should.equal("I have entered the room");
      response.from.should.equal(client_2_details.id);
      done();
    });
    makeSocketRequest(client2, "roomChange otherRoom" + "\r\n");
  });

  it('Folks are notified when I leave a room', function(done){
    makeSocketRequest(client, "", function(response){
      response.message.should.equal("I have left the room");
      response.from.should.equal(client_2_details.id);
      done();
    });
    makeSocketRequest(client2, "roomChange " + apiObj.configData.general.defaultChatRoom + "\r\n");
  });

  it('I can register for messages from rooms I am not in', function(done){
    this.timeout(5000);
    makeSocketRequest(client, "roomChange room1", function(response){
      makeSocketRequest(client2, "roomChange room2", function(response){
        makeSocketRequest(client, "listenToRoom room2", function(response){
          makeSocketRequest(client, "", function(response){
            response.message.should.eql("hello in room2")
            done();
          });
          makeSocketRequest(client2, "say hello in room2\r\n");
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
            makeSocketRequest(client, "", function(response){
              should.not.exist(response);
              done();
            });
            makeSocketRequest(client2, "say hello in room2\r\n");
          });
        });
      });
    });
  });

  it('I can get my id', function(done){
    makeSocketRequest(client, "detailsView" + "\r\n", function(response){
      client_details = response.data;
      done();
    });
  });

  it('can send auth\'d messages', function(done){
    rawAPI.connections.connections[client_details.id].auth = 'true';
    client2.write("paramAdd roomMatchKey=auth\r\n");
    client2.write("paramAdd roomMatchValue=true\r\n");
    client2.write("roomChange secretRoom\r\n");
    client.write("roomChange secretRoom\r\n");
    setTimeout(function(){
      makeSocketRequest(client, "", function(response){
        response.message.should.equal("secretAuthTest");
        response.from.should.equal(client_2_details.id);
        done();
      });
      makeSocketRequest(client2, "say secretAuthTest" + "\r\n");
    },500) 
  });

  it('doesn\'t send messages to people who are not authed', function(done){
    rawAPI.connections.connections[client_details.id].auth = 'false';
    client2.write("paramAdd roomMatchKey=auth\r\n");
    client2.write("paramAdd roomMatchValue=true\r\n");
    client2.write("roomChange secretRoom\r\n");
    client.write("roomChange secretRoom\r\n");
    setTimeout(function(){
      makeSocketRequest(client, "", function(response){
        should.not.exist(response);
        done();
      });
      makeSocketRequest(client2, "say secretAuthTest" + "\r\n");
    },500) 
  });

});