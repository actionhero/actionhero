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

describe('Server: Socket', function(){

  before(function(done){
    actionhero.start(function(err, a){
      api = a;

      setTimeout(function(){
        done();
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

  it('default params are set', function(done){
    makeSocketRequest(client, 'paramsView', function(response){
      response.should.be.an.instanceOf(Object)
      response.data.limit.should.equal(100)
      response.data.offset.should.equal(0)
      done();
    });
  });

  it('params can be updated', function(done){
    makeSocketRequest(client, 'paramAdd limit=50', function(response){
      response.status.should.equal('OK');
      makeSocketRequest(client, 'paramsView', function(response){
        response.data.limit.should.equal(String(50))
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
            response.error.should.eql('you have too many pending requests');
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

    beforeEach(function(done){
      makeSocketRequest(client, 'roomChange defaultRoom');
      makeSocketRequest(client2, 'roomChange defaultRoom');
      makeSocketRequest(client3, 'roomChange defaultRoom');
      setTimeout(function(){
        done();
      }, 250);
    })

    it('clients are in the default room', function(done){
      makeSocketRequest(client, 'roomView', function(response){
        response.data.room.should.equal('defaultRoom');
        done();
      });
    });

    it('clients can view additional info about rooms they are in', function(done){
      makeSocketRequest(client, 'roomView', function(response){
        response.data.membersCount.should.equal(3)
        done();
      });
    });

    it('rooms can be changed', function(done){
      makeSocketRequest(client, 'roomChange otherRoom', function(response){
        response.status.should.equal('OK')
        makeSocketRequest(client, 'roomView', function(response){
          response.data.room.should.equal('otherRoom');
          done();
        })
      });
    });

    it('connections in the first room see the count go down', function(done){
      makeSocketRequest(client, 'roomChange otherRoom', function(response){
        makeSocketRequest(client2, 'roomView', function(response){
          response.data.room.should.equal('defaultRoom');
          response.data.membersCount.should.equal(2)
          done();
        });
      });
    });

    it('folks in my room hear what I say (and say works)', function(done){
      makeSocketRequest(client3, '', function(response){
        response.message.should.equal('hello?');
        done();
      });
      makeSocketRequest(client2, 'say hello?' + '\r\n');
    });

    it('folks NOT in my room DON\'T hear what I say', function(done){
      makeSocketRequest(client, 'roomChange otherRoom', function(response){
        makeSocketRequest(client, '', function(response){
          should.not.exist(response);
          done();
        });
        makeSocketRequest(client2, 'say hello?' + '\r\n');
      });
    });

    it('Folks are notified when I join a room', function(done){
      makeSocketRequest(client, 'roomChange otherRoom', function(response){
        makeSocketRequest(client, '', function(response){
          response.message.should.equal('I have entered the room');
          response.from.should.equal(client_2_details.id);
          done();
        });

        makeSocketRequest(client2, 'roomChange otherRoom' + '\r\n');
      });
    });

    it('Folks are notified when I leave a room', function(done){
      makeSocketRequest(client, '', function(response){
        response.message.should.equal('I have left the room');
        response.from.should.equal(client_2_details.id);
        done();
      });

      makeSocketRequest(client2, 'roomChange otherRoom\r\n');
    });

    it('I can register for messages from rooms I am not in', function(done){
      makeSocketRequest(client, 'roomChange defaultRoom', function(response){
        makeSocketRequest(client2, 'roomChange otherRoom', function(response){
          makeSocketRequest(client, 'listenToRoom otherRoom', function(response){
            makeSocketRequest(client, '', function(response){
              response.message.should.eql('hello in otherRoom')
              done();
            });
            makeSocketRequest(client2, 'say hello in otherRoom\r\n');
          });
        });
      });
    });

    it('I can unregister for messages from rooms I am not in', function(done){
      makeSocketRequest(client, 'roomChange defaultRoom', function(response){
        makeSocketRequest(client2, 'roomChange otherRoom', function(response){
          makeSocketRequest(client, 'listenToRoom otherRoom', function(response){
            makeSocketRequest(client, 'silenceRoom otherRoom', function(response){
              makeSocketRequest(client, '', function(response){
                should.not.exist(response);
                done();
              });
              makeSocketRequest(client2, 'say hello in otherRoom\r\n');
            });
          });
        });
      });
    });

    it('I can get my id', function(done){
      makeSocketRequest(client, 'detailsView' + '\r\n', function(response){
        client_details = response.data;
        done();
      });
    });

    it('can join secure rooms when applicable', function(done){
      api.connections.connections[client_details.id].authorized = true;
      makeSocketRequest(client, 'roomChange secureRoom', function(response){
        response.data.should.equal(true);
        response.status.should.equal('OK');
        done();
      });
    });

    it('cannot join secure rooms when missing attributes', function(done){
      api.connections.connections[client_details.id].authorized = false;
      makeSocketRequest(client, 'roomChange secureRoom', function(response){
        response.data.should.equal(false);
        response.status.should.equal('not authorized to join room');
        done();
      });
    });
  
  });

});