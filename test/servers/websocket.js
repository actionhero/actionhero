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

  it('socket client connections should work: client 1', function(done){
    clientA.connect(function(error, data){
      data.context.should.equal('response');
      data.data.totalActions.should.equal(0);
      clientA.welcomeMessage.should.equal('Hello! Welcome to the actionhero api');
      done();
    });
  });

  it('socket client connections should work: client 2', function(done){
    clientB.connect(function(error, data){
      data.context.should.equal('response');
      data.data.totalActions.should.equal(0);
      clientA.welcomeMessage.should.equal('Hello! Welcome to the actionhero api');
      done();
    });
  });

  it('socket client connections should work: client 3', function(done){
    clientC.connect(function(error, data){
      data.context.should.equal('response');
      data.data.totalActions.should.equal(0);
      clientA.welcomeMessage.should.equal('Hello! Welcome to the actionhero api');
      done();
    });
  });

  it('I can get my connection details', function(done){
    clientA.detailsView(function(response){
      response.data.connectedAt.should.be.within(0, new Date().getTime());
      response.data.remoteIP.should.equal('127.0.0.1');
      done();
    });
  });

  it('can run actions with errors', function(done){
    clientA.action('cacheTest', function(response){
      response.error.should.equal('key is a required parameter for this action');
      done();
    });
  });

  it('can run actions properly', function(done){
    clientA.action('cacheTest', {key: 'test key', value: 'test value'}, function(response){
      should.not.exist(response.error);
      done();
    });
  });

  it('does not have sticky params', function(done){
    clientA.action('cacheTest', {key: 'test key', value: 'test value'}, function(response){
      should.not.exist(response.error);
      response.cacheTestResults.loadResp.key.should.equal('cacheTest_test key');
      response.cacheTestResults.loadResp.value.should.equal('test value');
      clientA.action('cacheTest', function(response){
        response.error.should.equal('key is a required parameter for this action');
        done();
      });
    });
  });

  it('will limit how many simultaneous connections I can have', function(done){
    var responses = [];
    clientA.action('sleepTest', {sleepDuration: 100}, function(response){ responses.push(response); });
    clientA.action('sleepTest', {sleepDuration: 200}, function(response){ responses.push(response); });
    clientA.action('sleepTest', {sleepDuration: 300}, function(response){ responses.push(response); });
    clientA.action('sleepTest', {sleepDuration: 400}, function(response){ responses.push(response); });
    clientA.action('sleepTest', {sleepDuration: 500}, function(response){ responses.push(response); });
    clientA.action('sleepTest', {sleepDuration: 600}, function(response){ responses.push(response); });

    setTimeout(function(){
      responses.length.should.equal(6);
      for(var i in responses){
        var response = responses[i];
        if(i === 0 || i === '0'){
          response.error.should.eql('you have too many pending requests');
        }else{
          should.not.exist(response.error);
        }
      }
      done();
    }, 1000);
  });

  describe('files', function(){
    it('can request file data', function(done){
      clientA.file('simple.html', function(data){
        should.not.exist(data.error);
        data.content.should.equal('<h1>ActionHero</h1>\\nI am a flat file being served to you via the API from ./public/simple.html<br />');
        data.mime.should.equal('text/html');
        data.length.should.equal(101);
        done();
      });
    });

    it('missing files', function(done){
      clientA.file('missing.html', function(data){
        data.error.should.equal('That file is not found (missing.html)');
        data.mime.should.equal('text/html');
        should.not.exist(data.content);
        done();
      });
    });
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
    });

    after(function(done){
      api.chatRoom.middleware = {};
      api.chatRoom.globalMiddleware = [];

      done();
    });

    beforeEach(function(done){
      clientA.roomAdd('defaultRoom', function(){
        clientB.roomAdd('defaultRoom', function(){
          clientC.roomAdd('defaultRoom', function(){
            setTimeout(function(){ // timeout to skip welcome messages as clients join rooms
              done();
            }, 100);
          });
        });
      });
    });

    afterEach(function(done){
      clientA.roomLeave('defaultRoom', function(){
        clientB.roomLeave('defaultRoom', function(){
          clientC.roomLeave('defaultRoom', function(){
            clientA.roomLeave('otherRoom', function(){
              clientB.roomLeave('otherRoom', function(){
                clientC.roomLeave('otherRoom', function(){
                  done();
                });
              });
            });
          });
        });
      });
    });

    it('can change rooms and get room details', function(done){
      clientA.roomAdd('otherRoom', function(){
        clientA.detailsView(function(response){
          should.not.exist(response.error);
          response.data.rooms[0].should.equal('defaultRoom');
          response.data.rooms[1].should.equal('otherRoom');
          clientA.roomView('otherRoom', function(response){
            response.data.membersCount.should.equal(1);
            done();
          });
        });
      });
    });

    it('will update client room info when they change rooms', function(done){
      clientA.rooms[0].should.equal('defaultRoom');
      should.not.exist(clientA.rooms[1]);
      clientA.roomAdd('otherRoom', function(response){
        should.not.exist(response.error);
        clientA.rooms[0].should.equal('defaultRoom');
        clientA.rooms[1].should.equal('otherRoom');
        clientA.roomLeave('defaultRoom', function(response){
          should.not.exist(response.error);
          clientA.rooms[0].should.equal('otherRoom');
          should.not.exist(clientA.rooms[1]);
          done();
        });
      });
    });

    it('Clients can talk to each other', function(done){
      var listener = function(response){
        clientA.removeListener('say', listener);
        response.context.should.equal('user');
        response.message.should.equal('hello from client 2');
        done();
      };

      clientA.on('say', listener);
      clientB.say('defaultRoom', 'hello from client 2');
    });

    it('The client say method does not rely on order', function(done){
      var listener = function(response){
        clientA.removeListener('say', listener);
        response.context.should.equal('user');
        response.message.should.equal('hello from client 2');
        done();
      };

      clientB.say = function(room, message, callback){
        this.send({message: message, room: room, event: 'say'}, callback);
      };

      clientA.on('say', listener);
      clientB.say('defaultRoom', 'hello from client 2');
    });

    it('connections are notified when I join a room', function(done){
      var listener = function(response){
        clientA.removeListener('say', listener);
        response.context.should.equal('user');
        response.message.should.equal('I have entered the room: ' + clientB.id);
        done();
      };

      clientA.roomAdd('otherRoom', function(){
        clientA.on('say', listener);
        clientB.roomAdd('otherRoom');
      });
    });

    it('connections are notified when I leave a room', function(done){
      var listener = function(response){
        clientA.removeListener('say', listener);
        response.context.should.equal('user');
        response.message.should.equal('I have left the room: ' + clientB.id);
        done();
      };

      clientA.on('say', listener);
      clientB.roomLeave('defaultRoom');
    });

    it('will not get messages for rooms I am not in', function(done){
      clientB.roomAdd('otherRoom', function(response){
        should.not.exist(response.error);
        clientB.rooms.length.should.equal(2);

        var listener = function(response){
          clientC.removeListener('say', listener);
          should.not.exist(response);
        };

        clientC.rooms.length.should.equal(1);
        clientC.on('say', listener);

        setTimeout(function(){
          clientC.removeListener('say', listener);
          done();
        }, 1000);

        clientB.say('otherRoom', 'you should not hear this');
      });
    });

    it('connections can see member counts changing within rooms as folks join and leave', function(done){
      clientA.roomView('defaultRoom', function(response){
        response.data.membersCount.should.equal(3);
        clientB.roomLeave('defaultRoom', function(){
          clientA.roomView('defaultRoom', function(response){
            response.data.membersCount.should.equal(2);
            done();
          });
        });
      });
    });

    describe('middleware - say and onSayReceive', function(){
      before(function(done){
        clientA.roomAdd('defaultRoom', function(){
          clientB.roomAdd('defaultRoom', function(){
            clientC.roomAdd('defaultRoom', function(){
              setTimeout(function(){ // timeout to skip welcome messages as clients join rooms
                done();
              }, 100);
            });
          });
        });
      });

      after(function(done){
        clientA.roomLeave('defaultRoom', function(){
          clientB.roomLeave('defaultRoom', function(){
            clientC.roomLeave('defaultRoom', function(){
              done();
            });
          });
        });
      });

      afterEach(function(done){
        api.chatRoom.middleware = {};
        api.chatRoom.globalMiddleware = [];

        done();
      });

      it('each listener receive custom message', function(done){
        api.chatRoom.addMiddleware({
          name: 'say for each',
          say: function(connection, room, messagePayload, callback){
            messagePayload.message += ' - To: ' + connection.id;
            callback(null, messagePayload);
          }
        });

        var listenerA = function(response){
          clientA.removeListener('say', listenerA);
          response.message.should.equal('Test Message - To: ' + clientA.id); // clientA.id (Receiever)
        };

        var listenerB = function(response){
          clientB.removeListener('say', listenerB);
          response.message.should.equal('Test Message - To: ' + clientB.id); // clientB.id (Receiever)
        };

        var listenerC = function(response){
          clientC.removeListener('say', listenerC);
          response.message.should.equal('Test Message - To: ' + clientC.id); // clientC.id (Receiever)
        };

        clientA.on('say', listenerA);
        clientB.on('say', listenerB);
        clientC.on('say', listenerC);
        clientB.say('defaultRoom', 'Test Message');

        setTimeout(function(){
          clientA.removeListener('say', listenerA);
          clientB.removeListener('say', listenerB);
          clientC.removeListener('say', listenerC);
          done();
        }, 1000);
      });

      it('only one message should be received per connection', function(done){
        var firstSayCall = true;
        api.chatRoom.addMiddleware({
          name: 'first say middleware',
          say: function(connection, room, messagePayload, callback){
            if(firstSayCall){
              firstSayCall = false;
              setTimeout(function(){
                callback();
              }, 200);
            }else{
              callback();
            }
          }
        });

        var messagesReceived = 0;
        var listenerA = function(response){
          messagesReceived += 1;
        };

        var listenerB = function(response){
          messagesReceived += 2;
        };

        var listenerC = function(response){
          messagesReceived += 4;
        };

        clientA.on('say', listenerA);
        clientB.on('say', listenerB);
        clientC.on('say', listenerC);
        clientB.say('defaultRoom', 'Test Message');

        setTimeout(function(){
          clientA.removeListener('say', listenerA);
          clientB.removeListener('say', listenerB);
          clientC.removeListener('say', listenerC);
          messagesReceived.should.equal(7);
          done();
        }, 1000);
      });

      it('each listener receive same custom message', function(done){
        api.chatRoom.addMiddleware({
          name: 'say for each',
          onSayReceive: function(connection, room, messagePayload, callback){
            messagePayload.message += ' - To: ' + connection.id;
            callback(null, messagePayload);
          }
        });

        var listenerA = function(response){
          clientA.removeListener('say', listenerA);
          response.message.should.equal('Test Message - To: ' + clientB.id); // clientB.id (Sender)
        };

        var listenerB = function(response){
          clientB.removeListener('say', listenerB);
          response.message.should.equal('Test Message - To: ' + clientB.id); // clientB.id (Sender)
        };

        var listenerC = function(response){
          clientC.removeListener('say', listenerC);
          response.message.should.equal('Test Message - To: ' + clientB.id); // clientB.id (Sender)
        };

        clientA.on('say', listenerA);
        clientB.on('say', listenerB);
        clientC.on('say', listenerC);
        clientB.say('defaultRoom', 'Test Message');

        setTimeout(function(){
          clientA.removeListener('say', listenerA);
          clientB.removeListener('say', listenerB);
          clientC.removeListener('say', listenerC);
          done();
        }, 1000);
      });
    });

    describe('custom room member data', function(){

      var currentSanitize;
      var currentGenerate;

      before(function(done){
        //Ensure that default behavior works
        clientA.roomAdd('defaultRoom', function(){
          clientA.roomView('defaultRoom', function(response){
            response.data.room.should.equal('defaultRoom');

            for(var key in response.data.members){
              (response.data.members[key].type === undefined).should.eql(true);
            }

            //save off current functions
            currentSanitize = api.chatRoom.sanitizeMemberDetails;
            currentGenerate = api.chatRoom.generateMemberDetails;

            //override functions
            api.chatRoom.sanitizeMemberDetails = function(data){
              return {
                id: data.id,
                joinedAt: data.joinedAt,
                type: data.type
              };
            };

            api.chatRoom.generateMemberDetails = function(connection){
              return {
                id: connection.id,
                joinedAt: new Date().getTime(),
                type: connection.type
              };
            };

            clientA.roomLeave('defaultRoom', function(){
              done();
            });
          });
        });
      });

      after(function(done){
        api.chatRoom.joinCallbacks  = {};
        api.chatRoom.leaveCallbacks = {};

        api.chatRoom.sanitizeMemberDetails = currentSanitize;
        api.chatRoom.generateMemberDetails = currentGenerate;

        //Check that everything is back to normal
        clientA.roomAdd('defaultRoom', function(){
          clientA.roomView('defaultRoom', function(response){
            response.data.room.should.equal('defaultRoom');
            for(var key in response.data.members){
              (response.data.members[key].type === undefined).should.eql(true);
            }
            setTimeout(function(){
              clientA.roomLeave('defaultRoom', function(){
                done();
              });
            }, 100);
          });
        });
      });

      it('should view non-default member data', function(done){
        clientA.roomAdd('defaultRoom', function(){
          clientA.roomView('defaultRoom', function(response){
            response.data.room.should.equal('defaultRoom');
            for(var key in response.data.members){
              response.data.members[key].type.should.eql('websocket');
            }
            clientA.roomLeave('defaultRoom');
            done();
          });
        });
      });

    });

  });

  describe('param collisions', function(){
    var originalSimultaneousActions;

    before(function(){
      originalSimultaneousActions = api.config.general.simultaneousActions;
      api.config.general.simultaneousActions = 99999999;
    });

    after(function(){
      api.config.general.simultaneousActions = originalSimultaneousActions;
    });

    it('will not have param colisions', function(done){
      var completed = 0;
      var started   = 0;
      var sleeps = [100, 101, 102, 103, 104, 105, 106, 107, 108, 109, 110];

      var toComplete = function(sleep, response){
        sleep.should.equal(response.sleepDuration);
        completed++;
        if(completed === started){
          done();
        }
      };

      sleeps.forEach(function(sleep){
        started++;
        clientA.action('sleepTest', {sleepDuration: sleep}, function(response){ toComplete(sleep, response); });
      });
    });
  });

  describe('disconnect', function(){

    beforeEach(function(done){
      try{
        clientA.disconnect();
        clientB.disconnect();
        clientC.disconnect();
      }catch(e){}

      connectClients(function(){
        clientA.connect();
        clientB.connect();
        clientC.connect();
        setTimeout(done, 500);
      });
    });

    it('client can disconnect', function(done){
      api.servers.servers.websocket.connections().length.should.equal(3);
      clientA.disconnect();
      clientB.disconnect();
      clientC.disconnect();
      setTimeout(function(){
        api.servers.servers.websocket.connections().length.should.equal(0);
        done();
      }, 500);
    });

    it('can be sent disconnect events from the server', function(done){
      clientA.detailsView(function(response){
        response.data.remoteIP.should.equal('127.0.0.1');

        var count = 0;
        for(var id in api.connections.connections){
          count++;
          api.connections.connections[id].destroy();
        }
        count.should.equal(3);

        clientA.detailsView(function(){
          throw new Error('should not get response');
        });

        setTimeout(done, 500);
      });
    });

  });

});
