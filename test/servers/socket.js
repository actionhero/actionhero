var should = require('should');
var uuid   = require('node-uuid');
var actionheroPrototype = require(__dirname + '/../../actionhero.js').actionheroPrototype;
var actionhero = new actionheroPrototype();
var api;

var net = require('net');
var client = {};
var client2 = {};
var client3 = {};

var clientDetails = {};
var client2Details = {};

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
    if(lastLine === ''){ lastLine = lines[(lines.length - 2)] }
    var parsed = null;
    try { parsed = JSON.parse(lastLine) } catch(e){}
    thisClient.removeListener('data', rsp);
    if(typeof cb === 'function'){ cb(parsed) }
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
    actionhero.stop(function(){
      done();
    });
  });

  it('socket connections should be able to connect and get JSON', function(done){
    makeSocketRequest(client, 'hello', function(response){
      response.should.be.an.instanceOf(Object)
      response.error.should.equal('unknown action or invalid apiVersion');
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
        key: uuid.v4(),
        value: uuid.v4() + uuid.v4() + uuid.v4() + uuid.v4() + uuid.v4() + uuid.v4() + uuid.v4() + uuid.v4() + uuid.v4() + uuid.v4()
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
      client2Details = response.data; // save for later!
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
    makeSocketRequest(client, 'paramDelete key', function(){
      makeSocketRequest(client, 'cacheTest', function(response){
        response.error.should.equal('key is a required parameter for this action')
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
      response.error.should.equal('value is a required parameter for this action')
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
      if(responses.length === 6){
        client.removeListener('data', checkResponses);
        for(var i in responses){
          var response = responses[i];
          if(i === '0'){
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

    before(function(done){
      api.chatRoom.addMiddleware({
        name: 'join chat middleware',
        join: function(connection, room, callback){
          api.chatRoom.broadcast({}, room, 'I have entered the room: ' + connection.id, function(e){
            callback();
          });
        }
      });

      api.chatRoom.addMiddleware({
        name: 'leave chat middleware',
        leave: function(connection, room, callback){
          api.chatRoom.broadcast({}, room, 'I have left the room: ' + connection.id, function(e){
            callback();
          });
        }
      });

      done();
    })

    after(function(done){
      api.chatRoom.middleware = {};
      api.chatRoom.globalMiddleware = [];

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
      ['defaultRoom', 'otherRoom'].forEach(function(room){
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
      makeSocketRequest(client, 'roomAdd otherRoom', function(){
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
      makeSocketRequest(client, 'roomAdd   otherRoom', function(){
      makeSocketRequest(client, 'roomLeave defaultRoom', function(){
        makeSocketRequest(client2, 'roomView defaultRoom', function(response){
          response.data.room.should.equal('defaultRoom');
          response.data.membersCount.should.equal(2)
          done();
        });
      });
      });
    });
    
    describe('custom room member data', function(){
    
    	var currentSanitize;
    	var currentGenerate;
    	
    	
    	before(function(done){
    	    //Ensure that default behavior works
			makeSocketRequest(client2, 'roomAdd defaultRoom', function(response){
			  makeSocketRequest(client2, 'roomView defaultRoom', function(response){
				  response.data.room.should.equal('defaultRoom');
				  for( var key in response.data.members ){
					(response.data.members[key].type === undefined ).should.eql(true);
				  }
				  makeSocketRequest(client2, 'roomLeave defaultRoom');

				  //save off current functions
				  currentSanitize = api.chatRoom.sanitizeMemberDetails;
				  currentGenerate = api.chatRoom.generateMemberDetails;

	 			  //override functions
				  api.chatRoom.sanitizeMemberDetails = function(data){
					return { id: data.id,
							 joinedAt: data.joinedAt,
							 type: data.type };
				  }
  
				  api.chatRoom.generateMemberDetails = function(connection){
					return { id: connection.id,
							 joinedAt: new Date().getTime(),
							 type : connection.type };
				  }			  
				  done();
			  });
			});
        })

		after(function(done){
		  api.chatRoom.joinCallbacks  = {};
		  api.chatRoom.leaveCallbacks = {};
		  
		  api.chatRoom.sanitizeMemberDetails = currentSanitize;
		  api.chatRoom.generateMemberDetails = currentGenerate;
		          
		  //Check that everything is back to normal
		  makeSocketRequest(client2, 'roomAdd defaultRoom', function(response){
			  makeSocketRequest(client2, 'roomView defaultRoom', function(response){
				  response.data.room.should.equal('defaultRoom');
				  for( var key in response.data.members ){
					(response.data.members[key].type === undefined ).should.eql(true);
				  }
				  makeSocketRequest(client2, 'roomLeave defaultRoom');

				  done();
			  });
		  });
		})
		
		it('should view non-default member data', function(done){
			makeSocketRequest(client2, 'roomAdd defaultRoom', function(response){
				makeSocketRequest(client2, 'roomView defaultRoom', function(response){
				  response.data.room.should.equal('defaultRoom');
				  for( var key in response.data.members ){
					response.data.members[key].type.should.eql('socket');
				  }
				  makeSocketRequest(client2, 'roomLeave defaultRoom');
				  done();
				});
			})
		});	
    
    } );

    it('folks in my room hear what I say (and say works)', function(done){
      makeSocketRequest(client3, '', function(response){
        response.message.should.equal('hello?');
        done();
      });

      makeSocketRequest(client2, 'say defaultRoom hello?' + '\r\n');
    });

    it('folks NOT in my room DON\'T hear what I say', function(done){
      makeSocketRequest(client, 'roomLeave defaultRoom', function(){
        makeSocketRequest(client, '', function(response){
          should.not.exist(response);
          done();
        });
        makeSocketRequest(client2, 'say defaultRoom you should not hear this' + '\r\n');
      });
    });

    it('Folks are notified when I join a room', function(done){
      makeSocketRequest(client, 'roomAdd otherRoom', function(){
        makeSocketRequest(client2, 'roomAdd otherRoom' + '\r\n');
        makeSocketRequest(client, '', function(response){
          response.message.should.equal('I have entered the room: ' + client2Details.id);
          response.from.should.equal(0);
          done();
        });
      });
    });

    it('Folks are notified when I leave a room', function(done){
      makeSocketRequest(client, '', function(response){
        response.message.should.equal('I have left the room: ' + client2Details.id);
        response.from.should.equal(0);
        done();
      });

      makeSocketRequest(client2, 'roomLeave defaultRoom\r\n');
    });

    it('I can get my id', function(done){
      makeSocketRequest(client, 'detailsView' + '\r\n', function(response){
        clientDetails = response.data;
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