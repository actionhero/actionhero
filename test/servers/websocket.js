var should = require('should');
var actionheroPrototype = require(__dirname + "/../../actionhero.js").actionheroPrototype;
var actionhero = new actionheroPrototype();
var api;

var client_1;
var client_2;
var client_3;

var connectClients = function(callback){
  // get actionheroClient in scope
  eval( api.servers.servers.websocket.compileActionheroClientJS() );
  
  var S = api.servers.servers.websocket.server.Socket;
  var url = 'http://localhost:' + api.config.servers.web.port;
  var client_1_socket = new S(url);
  var client_2_socket = new S(url);
  var client_3_socket = new S(url);

  client_1 = new actionheroClient({}, client_1_socket);
  client_2 = new actionheroClient({}, client_2_socket);
  client_3 = new actionheroClient({}, client_3_socket);

  setTimeout(function(){
    callback();
  }, 100);
}

describe('Server: Web Socket', function(){

  before(function(done){
    actionhero.start(function(err, a){
      api = a;

      connectClients(function(){
        done();
      });
    });
  });

  after(function(done){
    actionhero.stop(function(err){
      done();
    });
  });

  it('socket client connections should work: client 1', function(done){
    client_1.connect(function(err, data){
      data.context.should.equal('response');
      data.data.totalActions.should.equal(0);
      client_1.welcomeMessage.should.equal('Hello! Welcome to the actionhero api');
      done();
    });
  });

  it('socket client connections should work: client 2', function(done){
    client_2.connect(function(err, data){
      data.context.should.equal('response');
      data.data.totalActions.should.equal(0);
      client_1.welcomeMessage.should.equal('Hello! Welcome to the actionhero api');
      done();
    });
  });

  it('socket client connections should work: client 3', function(done){
    client_3.connect(function(err, data){
      data.context.should.equal('response');
      data.data.totalActions.should.equal(0);
      client_1.welcomeMessage.should.equal('Hello! Welcome to the actionhero api');
      done();
    });
  });

  it('I can get my connection details', function(done){
    client_1.detailsView(function(response){
      response.data.connectedAt.should.be.within(0, new Date().getTime())
      response.data.remoteIP.should.equal('127.0.0.1');
      done()
    });
  });

  it('can run actions with errors', function(done){
    client_1.action('cacheTest', function(response){
      response.error.should.equal('Error: key is a required parameter for this action');
      done();
    });
  });

  it('can run actions properly', function(done){
    client_1.action('cacheTest', {key: 'test key', value: 'test value'}, function(response){
      should.not.exist(response.error);
      done();
    });
  });

  it('has sticky params', function(done){
    client_1.action('cacheTest', {key: 'test key', value: 'test value'}, function(response){
      should.not.exist(response.error);
      response.cacheTestResults.loadResp.key.should.equal('cacheTest_test key');
      response.cacheTestResults.loadResp.value.should.equal('test value');
      client_1.action('cacheTest', {key: 'test key', value: 'test value'}, function(response){
        response.cacheTestResults.loadResp.key.should.equal('cacheTest_test key');
        response.cacheTestResults.loadResp.value.should.equal('test value');
        done();
      });
    });
  });

  it('will limit how many simultaneous connections I can have', function(done){
    var responses = [];
    client_1.action('sleepTest', {sleepDuration: 100}, function(response){ responses.push(response) })
    client_1.action('sleepTest', {sleepDuration: 200}, function(response){ responses.push(response) })
    client_1.action('sleepTest', {sleepDuration: 300}, function(response){ responses.push(response) })
    client_1.action('sleepTest', {sleepDuration: 400}, function(response){ responses.push(response) })
    client_1.action('sleepTest', {sleepDuration: 500}, function(response){ responses.push(response) })
    client_1.action('sleepTest', {sleepDuration: 600}, function(response){ responses.push(response) })

    setTimeout(function(){
      responses.length.should.equal(6);
      for(var i in responses){
        var response = responses[i];
        if(i == 0){
          response.error.should.eql('Error: you have too many pending requests');
        } else {
          should.not.exist(response.error)
        }
      }
      done();
    }, 1000);
  });

  describe('files', function(){
    it('can request file data', function(done){
      client_1.file('simple.html', function(data){
        should.not.exist(data.error);
        data.content.should.equal('<h1>ActionHero</h1>\\nI am a flat file being served to you via the API from ./public/simple.html<br />');
        data.mime.should.equal('text/html');
        data.length.should.equal(101);
        done();
      });
    });

    it('missing files', function(done){
      client_1.file('missing.html', function(data){
        data.error.should.equal( api.config.errors.fileNotFound() );
        data.mime.should.equal('text/html');
        should.not.exist(data.content);
        done();
      });
    });
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
      client_1.roomAdd('defaultRoom',function(response){
      client_2.roomAdd('defaultRoom',function(response){
      client_3.roomAdd('defaultRoom',function(response){
        setTimeout(function(){ // timeout to skip welcome messages as clients join rooms
          done();
        }, 100);
      });
      });
      });
    });

    afterEach(function(done){
      client_1.roomLeave('defaultRoom',function(response){
      client_2.roomLeave('defaultRoom',function(response){
      client_3.roomLeave('defaultRoom',function(response){
      client_1.roomLeave('otherRoom',function(response){
      client_2.roomLeave('otherRoom',function(response){
      client_3.roomLeave('otherRoom',function(response){
      client_1.roomLeave('secureRoom',function(response){
      client_2.roomLeave('secureRoom',function(response){
      client_3.roomLeave('secureRoom',function(response){
          done();
      }); }); }); }); }); }); }); }); });
    });

    it('can change rooms and get room details', function(done){
      client_1.roomAdd('otherRoom', function(){
        client_1.detailsView(function(response){
          should.not.exist(response.error);
          response.data.rooms[0].should.equal('defaultRoom');
          response.data.rooms[1].should.equal('otherRoom');
          client_1.roomView('otherRoom', function(response){
            response.data.membersCount.should.equal(1);
            done();
          });
        });
      });
    });

    it('Clients can talk to each other', function(done){
      var listener = client_1.on('say', function(response){
        client_1.removeListener('say', listener);
        response.context.should.equal('user');
        response.message.should.equal('hello from client 2');
        done();
      });

      client_2.say('defaultRoom', 'hello from client 2');
    });

    it('will not get messages for rooms I am not in', function(done){
      var listener = client_1.on('say', function(response){
        response.should.not.exist();
      });

      setTimeout(function(){
        client_1.removeListener('say', listener);
        done();
      }, 500)

      client_2.roomAdd('otherRoom', function(){
        client_2.say('otherRoom', 'you should not hear this');
      });
    });

    it('connections are notified when I join a room', function(done){
      client_1.roomAdd('otherRoom', function(){
        var listener = client_1.on('say', function(response){
          client_1.removeListener('say', listener);
          response.context.should.equal('user');
          response.message.should.equal('I have entered the room');
          done();
        });

        client_2.roomAdd('otherRoom');
      });
    });

    it('connections are notified when I leave a room', function(done){
      var listener = client_1.on('say', function(response){
        client_1.removeListener('say', listener);
        response.context.should.equal('user');
        response.message.should.equal('I have left the room');
        done();
      });

      client_2.roomLeave('defaultRoom');
    })

    it('connections can see member counts changing within rooms as folks join and leave', function(done){
      client_1.roomView('defaultRoom', function(response){
        response.data.membersCount.should.equal(3);
        client_2.roomLeave('defaultRoom', function(){
          client_1.roomView('defaultRoom', function(response){
            response.data.membersCount.should.equal(2);
            done();
          });
        });
      });
    });

    it('connections can join secure rooms', function(done){
      api.connections.connections[client_1.id].authorized = true;
      client_1.roomAdd('secureRoom', function(data){
        data.status.should.equal('OK');
        done();
      });
    });

    it('connections can be blocked from secure rooms', function(done){
      api.connections.connections[client_1.id].authorized = false;
      client_1.roomAdd('secureRoom', function(data){
        data.status.should.equal('not authorized to join room');
        done();
      });
    });

  });

  describe('disconnect', function(){

    beforeEach(function(done){
      try{
        client_1.disconnect();
        client_2.disconnect();
        client_3.disconnect();
      }catch(e){} 

      connectClients(function(){
        client_1.connect();
        client_2.connect();
        client_3.connect();
        setTimeout(done, 500);
      });
    });

    it('client can disconnect', function(done){
      api.servers.servers.websocket.connections().length.should.equal(3);
      client_1.disconnect();
      client_2.disconnect();
      client_3.disconnect();
      setTimeout(function(){
        api.servers.servers.websocket.connections().length.should.equal(0);
        done();
      }, 500);
    });

    it('can be sent disconnect events from the server', function(done){
      client_1.detailsView(function(response){
        response.data.remoteIP.should.equal('127.0.0.1');
        
        var count = 0
        for(var id in api.connections.connections){
          count++;
          api.connections.connections[id].destroy();
        }
        count.should.equal(3);

        client_1.detailsView(function(response){
          throw new Error("should not get responst")
        });

        setTimeout(done, 500)
      });
    });

  });

});
