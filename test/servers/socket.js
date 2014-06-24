var should = require('should');
var actionheroPrototype = require(__dirname + "/../../actionhero.js").actionheroPrototype;
var actionhero = new actionheroPrototype();
var api;

var net = require('net');
var client = {};
var client2 = {};
var client3 = {};

var client_details = {};
var client_2_details = {};

function makeSocketRequest(thisClient, message, cb){
  var lines = [];

  var rsp = function(d){
    d.split('\n').forEach(function(l){
      lines.push(l);
    });
    lines.push()
  };

  setTimeout(function(){
    var lastLine = lines[(lines.length - 1)];
    if(lastLine == ''){ lastLine = lines[(lines.length - 2)] }
    var parsed = null;
    try { parsed = JSON.parse(lastLine) } catch(e){}
    thisClient.removeListener('data', rsp);
    if(typeof cb == 'function'){ cb(parsed) }
  }, 100);

  thisClient.on('data', rsp);
  thisClient.write(message + '\r\n');
}

var connectClients = function(callback){
  setTimeout(function(){
    callback();
  }, 1000);

  client = net.connect(api.config.servers.socket.port, function(){
    client.setEncoding('utf8');
  });
  client2 = net.connect(api.config.servers.socket.port, function(){
    client2.setEncoding('utf8');
  });
  client3 = net.connect(api.config.servers.socket.port, function(){
    client3.setEncoding('utf8');
  });
}

describe('Server: Socket', function(){

  before(function(done){
    actionhero.start(function(err, a){
      api = a;
      connectClients(done)
    });
  });

  after(function(done){
    client.write('quit\r\n');
    client2.write('quit\r\n');
    client3.write('quit\r\n');
    actionhero.stop(function(err){
      done();
    });
  });

  it('socket connections should be able to connect and get JSON', function(done){
    makeSocketRequest(client, 'hello', function(response){
      response.should.be.an.instanceOf(Object)
      response.error.should.equal('Error: hello is not a known action or that is not a valid apiVersion.');
      done();
    });
  });

  it('single string message are treated as actions', function(done){
    makeSocketRequest(client, 'status', function(response){
      response.should.be.an.instanceOf(Object)
      response.id.should.equal('test-server');
      done();
    });
  });

  it('stringified JSON can also be sent as actions', function(done){
    makeSocketRequest(client, JSON.stringify({action: 'status', params: {something: 'else'}}), function(response){
      response.should.be.an.instanceOf(Object)
      response.id.should.equal('test-server');
      done();
    });
  });

  it('really long messages are OK', function(done){
    var msg = {
      action: 'cacheTest',
      params: {
        key: api.utils.randomString(100),
        value: api.utils.randomString(500)
      }
    }
    makeSocketRequest(client, JSON.stringify(msg), function(response){
      response.cacheTestResults.loadResp.key.should.eql('cacheTest_' + msg.params.key);
      response.cacheTestResults.loadResp.value.should.eql(msg.params.value);
      done();
    });
  });

  it('I can get my details', function(done){
    makeSocketRequest(client2, 'detailsView', function(response){
      response.status.should.equal('OK')
      response.data.should.be.an.instanceOf(Object)
      response.data.params.should.be.an.instanceOf(Object)
      response.data.connectedAt.should.be.within(10, new Date().getTime())
      client_2_details = response.data; // save for later!
      done();
    });
  });

  it('params can be updated', function(done){
    makeSocketRequest(client, 'paramAdd key=otherKey', function(response){
      response.status.should.equal('OK');
      makeSocketRequest(client, 'paramsView', function(response){
        response.data.key.should.equal('otherKey');
        done();
      });
    });
  });

  it('actions will fail without proper params set to the connection', function(done){
    makeSocketRequest(client, 'paramDelete key', function(response){
      makeSocketRequest(client, 'cacheTest', function(response){
        response.error.should.equal('Error: key is a required parameter for this action')
        done();
      });
    });
  });

  it('a new param can be added', function(done){
    makeSocketRequest(client, 'paramAdd key=socketTestKey', function(response){
      response.status.should.equal('OK');
      done();
    });
  });

  it('a new param can be viewed once added', function(done){
    makeSocketRequest(client, 'paramView key', function(response){
      response.data.should.equal('socketTestKey')
      done();
    });
  });


  it('another new param can be added', function(done){
    makeSocketRequest(client, 'paramAdd value=abc123', function(response){
      response.status.should.equal('OK');
      done();
    });
  });

  it('actions will work once all the needed params are added', function(done){
    makeSocketRequest(client, 'cacheTest', function(response){
      response.cacheTestResults.saveResp.should.equal(true);
      done();
    });
  });

  it('params are sticky between actions', function(done){
    makeSocketRequest(client, 'cacheTest', function(response){
      should.not.exist(response.error);
      response.cacheTestResults.loadResp.key.should.equal('cacheTest_socketTestKey');
      response.cacheTestResults.loadResp.value.should.equal('abc123');
      makeSocketRequest(client, 'cacheTest', function(response){
        response.cacheTestResults.loadResp.key.should.equal('cacheTest_socketTestKey');
        response.cacheTestResults.loadResp.value.should.equal('abc123');
        done();
      });
    });
  });

  it('only params sent in a JSON block are used', function(done){
    makeSocketRequest(client, JSON.stringify({action: 'cacheTest', params: {key: 'someOtherValue'}}), function(response){
      response.error.should.equal('Error: value is a required parameter for this action')
      done();
    });
  });

  it('will limit how many simultaneous connections I can have', function(done){
    client.write(JSON.stringify({action: 'sleepTest', params: {sleepDuration: 500}}) + '\r\n');
    client.write(JSON.stringify({action: 'sleepTest', params: {sleepDuration: 600}}) + '\r\n');
    client.write(JSON.stringify({action: 'sleepTest', params: {sleepDuration: 700}}) + '\r\n');
    client.write(JSON.stringify({action: 'sleepTest', params: {sleepDuration: 800}}) + '\r\n');
    client.write(JSON.stringify({action: 'sleepTest', params: {sleepDuration: 900}}) + '\r\n');
    client.write(JSON.stringify({action: 'sleepTest', params: {sleepDuration: 1000}}) + '\r\n');

    var responses = []
    var checkResponses = function(data){
      data.split('\n').forEach(function(line){
        if(line.length > 0){
          responses.push(JSON.parse(line));
        }
      })
      if(responses.length == 6){
        client.removeListener('data', checkResponses);
        for(var i in responses){
          var response = responses[i];
          if(i == 0){
            response.error.should.eql('Error: you have too many pending requests');
          } else {
            should.not.exist(response.error)
          }
        }
        done();
      }
    }

    client.on('data', checkResponses);
  });

  describe('chat', function(){

    before(function(done){
      api.chatRoom.addJoinCallback(function(connection, room){
        api.chatRoom.broadcast(connection, room, 'I have entered the room');
      });

      api.chatRoom.addLeaveCallback(function(connection, room){
        api.chatRoom.broadcast(connection, room, 'I have left the room');
      });

      done();
    })

    after(function(done){
      api.chatRoom.joinCallbacks  = {};
      api.chatRoom.leaveCallbacks = {};

      done();
    })

    beforeEach(function(done){
      makeSocketRequest(client,  'roomAdd defaultRoom');
      makeSocketRequest(client2, 'roomAdd defaultRoom');
      makeSocketRequest(client3, 'roomAdd defaultRoom');
      setTimeout(function(){
        done();
      }, 250);
    });

    afterEach(function(done){
      ['defaultRoom', 'otherRoom', 'secureRoom'].forEach(function(room){
        makeSocketRequest(client,  'roomLeave ' + room);
        makeSocketRequest(client2, 'roomLeave ' + room);
        makeSocketRequest(client3, 'roomLeave ' + room);
      });
      setTimeout(function(){
        done();
      }, 250);
    });

    it('clients are in the default room', function(done){
      makeSocketRequest(client, 'roomView defaultRoom', function(response){
        response.data.room.should.equal('defaultRoom');
        done();
      });
    });

    it('clients can view additional info about rooms they are in', function(done){
      makeSocketRequest(client, 'roomView defaultRoom', function(response){
        response.data.membersCount.should.equal(3)
        done();
      });
    });

    it('rooms can be changed', function(done){
      makeSocketRequest(client, 'roomAdd otherRoom', function(response){
      makeSocketRequest(client, 'roomLeave defaultRoom', function(response){
        response.status.should.equal('OK')
        makeSocketRequest(client, 'roomView otherRoom', function(response){
          response.data.room.should.equal('otherRoom');
          done();
        })
      });
      });
    });

    it('connections in the first room see the count go down', function(done){
      makeSocketRequest(client, 'roomAdd   otherRoom', function(response){
      makeSocketRequest(client, 'roomLeave defaultRoom', function(response){
        makeSocketRequest(client2, 'roomView defaultRoom', function(response){
          response.data.room.should.equal('defaultRoom');
          response.data.membersCount.should.equal(2)
          done();
        });
      });
      });
    });

    it('folks in my room hear what I say (and say works)', function(done){
      makeSocketRequest(client3, '', function(response){
        response.message.should.equal('hello?');
        done();
      });

      makeSocketRequest(client2, 'say defaultRoom hello?' + '\r\n');
    });

    it('folks NOT in my room DON\'T hear what I say', function(done){
      makeSocketRequest(client, 'roomLeave defaultRoom', function(response){
        makeSocketRequest(client, '', function(response){
          should.not.exist(response);
          done();
        });
        makeSocketRequest(client2, 'say defaultRoom you should not hear this' + '\r\n');
      });
    });

    it('Folks are notified when I join a room', function(done){
      makeSocketRequest(client, 'roomAdd otherRoom', function(response){
        makeSocketRequest(client2, 'roomAdd otherRoom' + '\r\n');
        makeSocketRequest(client, '', function(response){
          response.message.should.equal('I have entered the room');
          response.from.should.equal(client_2_details.id);
          done();
        });
      });
    });

    it('Folks are notified when I leave a room', function(done){
      makeSocketRequest(client, '', function(response){
        response.message.should.equal('I have left the room');
        response.from.should.equal(client_2_details.id);
        done();
      });

      makeSocketRequest(client2, 'roomLeave defaultRoom\r\n');
    });

    it('I can get my id', function(done){
      makeSocketRequest(client, 'detailsView' + '\r\n', function(response){
        client_details = response.data;
        done();
      });
    });

    it('can join secure rooms when applicable', function(done){
      api.connections.connections[client_details.id].authorized = true;
      makeSocketRequest(client, 'roomAdd secureRoom', function(response){
        response.data.should.equal(true);
        response.status.should.equal('OK');
        done();
      });
    });

    it('cannot join secure rooms when missing attributes', function(done){
      api.connections.connections[client_details.id].authorized = false;
      makeSocketRequest(client, 'roomAdd secureRoom', function(response){
        response.data.should.equal(false);
        response.status.should.equal('not authorized to join room');
        done();
      });
    });
  
  });

  describe('disconnect', function(){
    after(function(done){
      connectClients(done);
    })

    it('server can disconnect a client', function(done){
      makeSocketRequest(client, 'status', function(response){
        response.id.should.equal('test-server');
        client.readable.should.equal(true)
        client.writable.should.equal(true)
        
        for(var id in api.connections.connections){
          api.connections.connections[id].destroy();
        }

        setTimeout(function(){
          client.readable.should.equal(false)
          client.writable.should.equal(false)
          done();
        }, 100)
      });
    });
  });

});