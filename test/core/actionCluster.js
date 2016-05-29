var should = require('should');
var actionheroPrototype = require(__dirname + '/../../actionhero.js').actionheroPrototype;

var actionhero1 = new actionheroPrototype();
var actionhero2 = new actionheroPrototype();
var actionhero3 = new actionheroPrototype();

var apiA;
var apiB;
var apiC;

var configChanges = {
  1: {
    general: {id: 'test-server-1'},
    servers: {}
  },
  2: {
    general: {id: 'test-server-2'},
    servers: {}
  },
  3: {
    general: {id: 'test-server-3'},
    servers: {}
  }
};

var startAllServers = function(next){
  actionhero1.start({configChanges: configChanges[1]}, function(error, a1){
    actionhero2.start({configChanges: configChanges[2]}, function(error, a2){
      actionhero3.start({configChanges: configChanges[3]}, function(error, a3){
        apiA = a1;
        apiB = a2;
        apiC = a3;
        next();
      });
    });
  });
};

var stopAllServers = function(next){
  actionhero1.stop(function(){
    actionhero2.stop(function(){
      actionhero3.stop(function(){
        next();
      });
    });
  });
};

describe('Core: Action Cluster', function(){

  describe('servers', function(){

    before(function(done){
      startAllServers(function(){
        done();
      });
    });

    after(function(done){
      stopAllServers(function(){
        done();
      });
    });

    describe('say and clients on separate servers', function(){

      var client1;
      var client2;
      var client3;

      before(function(done){
        client1 = new apiA.specHelper.connection();
        client2 = new apiB.specHelper.connection();
        client3 = new apiC.specHelper.connection();

        client1.verbs('roomAdd', 'defaultRoom');
        client2.verbs('roomAdd', 'defaultRoom');
        client3.verbs('roomAdd', 'defaultRoom');

        setTimeout(function(){
          done();
        }, 100);
      });

      after(function(done){
        client1.destroy();
        client2.destroy();
        client3.destroy();
        setTimeout(function(){
          done();
        }, 100);
      });

      it('all connections can join the default room and client #1 can see them', function(done){
        client1.verbs('roomView', 'defaultRoom', function(error, data){
          data.room.should.equal('defaultRoom');
          data.membersCount.should.equal(3);
          done();
        });
      });

      it('all connections can join the default room and client #2 can see them', function(done){
        client2.verbs('roomView', 'defaultRoom', function(error, data){
          data.room.should.equal('defaultRoom');
          data.membersCount.should.equal(3);
          done();
        });
      });

      it('all connections can join the default room and client #3 can see them', function(done){
        client3.verbs('roomView', 'defaultRoom', function(error, data){
          data.room.should.equal('defaultRoom');
          data.membersCount.should.equal(3);
          done();
        });
      });

      it('clients can communicate across the cluster', function(done){
        client1.verbs('say', ['defaultRoom', 'Hi', 'from', 'client', '1'], function(){
          setTimeout(function(){
            var message = client2.messages[(client2.messages.length - 1)];
            message.message.should.equal('Hi from client 1');
            message.room.should.equal('defaultRoom');
            message.from.should.equal(client1.id);
            done();
          }, 100);
        });
      });

    });

    describe('shared cache', function(){

      it('peer 1 writes and peer 2 should read', function(done){
        apiA.cache.save('test_key', 'yay', null, function(){
          apiB.cache.load('test_key', function(error, value){
            value.should.equal('yay');
            done();
          });
        });
      });

      it('peer 3 deletes and peer 1 cannot read any more', function(done){
        apiC.cache.destroy('test_key', function(){
          apiA.cache.load('test_key', function(error, value){
            should.not.exist(value);
            done();
          });
        });
      });

    });

    describe('RPC', function(){

      afterEach(function(done){
        delete apiA.rpcTestMethod;
        delete apiB.rpcTestMethod;
        delete apiC.rpcTestMethod;
        done();
      });

      it('can call remote methods on all other servers in the cluster', function(done){
        var data = {};

        apiA.rpcTestMethod = function(arg1, arg2, next){
          data[1] = [arg1, arg2]; next();
        };
        apiB.rpcTestMethod = function(arg1, arg2, next){
          data[2] = [arg1, arg2]; next();
        };
        apiC.rpcTestMethod = function(arg1, arg2, next){
          data[3] = [arg1, arg2]; next();
        };

        process.nextTick(function(){
          apiA.redis.doCluster('api.rpcTestMethod', ['arg1', 'arg2'], null, function(error){
            should.not.exist(error);
            // callback should work too!
            data[1][0].should.equal('arg1');
            data[1][1].should.equal('arg2');
            data[2][0].should.equal('arg1');
            data[2][1].should.equal('arg2');
            data[3][0].should.equal('arg1');
            data[3][1].should.equal('arg2');
            done();
          });
        });
      });

      it('can call remote methods only on one other cluster who holds a specific connectionId', function(done){
        var client = new apiA.specHelper.connection();

        var data = {};
        apiA.rpcTestMethod = function(arg1, arg2, next){
          data[1] = [arg1, arg2]; next();
        };
        apiB.rpcTestMethod = function(arg1, arg2, next){
          throw new Error('should not be here');
        };
        apiC.rpcTestMethod = function(arg1, arg2, next){
          throw new Error('should not be here');
        };

        apiB.redis.doCluster('api.rpcTestMethod', ['arg1', 'arg2'], client.id, function(error){
          should.not.exist(error);
          data[1][0].should.equal('arg1');
          data[1][1].should.equal('arg2');
          client.destroy();
          done();
        });
      });

      it('can get information about connections connected to other servers', function(done){
        var client = new apiA.specHelper.connection();

        apiB.connections.apply(client.id, function(connection){
          connection.id.should.equal(client.id);
          connection.type.should.equal('testServer');
          connection.canChat.should.equal(true);
          done();
        });
      });

      it('can call remote methods on/about connections connected to other servers', function(done){
        var client = new apiA.specHelper.connection();
        should.not.exist(client.auth);

        apiB.connections.apply(client.id, 'set', ['auth', true], function(connection){
          connection.id.should.equal(client.id);
          client.auth.should.equal(true);
          client.destroy();
          done();
        });
      });

      it('can send arbitraty messages to connections connected to other servers', function(done){
        var client = new apiA.specHelper.connection();

        apiB.connections.apply(client.id, 'sendMessage', {message: 'hi'}, function(connection){
          var message = connection.messages[(connection.messages.length - 1)];
          message.message.should.equal('hi');

          done();
        });
      });

      it('failing RPC calls with a callback will have a failure callback', function(done){
        this.timeout(apiA.config.general.rpcTimeout * 3);

        apiB.redis.doCluster('api.rpcTestMethod', [], 'A missing clientId', function(error){
          String(error).should.equal('Error: RPC Timeout');
          done();
        });
      });

    });

    describe('chat', function(){

      afterEach(function(done){
        apiA.chatRoom.destroy('newRoom', function(){
          done();
        });
      });

      it('can check if rooms exist', function(done){
        apiA.chatRoom.exists('defaultRoom', function(error, found){
          found.should.equal(true);
          done();
        });
      });

      it('can check if a room does not exist', function(done){
        apiA.chatRoom.exists('missingRoom', function(error, found){
          found.should.equal(false);
          done();
        });
      });

      it('server can create new room', function(done){
        var room = 'newRoom';
        apiA.chatRoom.exists(room, function(error, found){
          found.should.equal(false);
          apiA.chatRoom.add(room, function(error){
            apiA.chatRoom.exists(room, function(error, found){
              found.should.equal(true);
              done();
            });
          });
        });
      });

      it('server cannot create already existing room', function(done){
        apiA.chatRoom.add('defaultRoom', function(error){
          String(error).should.equal('room exists');
          done();
        });
      });

      it('can enumerate all the rooms in the system', function(done){
        apiA.chatRoom.add('defaultRoom', function(error){
          apiA.chatRoom.add('newRoom', function(error){
            apiA.chatRoom.list(function(error, rooms){
              should.not.exist(error);
              rooms.length.should.equal(3);
              ['defaultRoom', 'newRoom', 'otherRoom'].forEach(function(r){
                rooms.indexOf(r).should.be.greaterThan(-1);
              });
              done();
            });
          });
        });
      });

      it('server can add connections to a LOCAL room', function(done){
        var client = new apiA.specHelper.connection();
        client.rooms.length.should.equal(0);
        apiA.chatRoom.addMember(client.id, 'defaultRoom', function(error, didAdd){
          didAdd.should.equal(true);
          client.rooms[0].should.equal('defaultRoom');
          client.destroy();
          done();
        });
      });

      it('server can add connections to a REMOTE room', function(done){
        var client = new apiB.specHelper.connection();
        client.rooms.length.should.equal(0);
        apiA.chatRoom.addMember(client.id, 'defaultRoom', function(error, didAdd){
          didAdd.should.equal(true);
          client.rooms.length.should.equal(1);
          client.rooms[0].should.equal('defaultRoom');
          client.destroy();
          done();
        });
      });

      it('will not re-add a member to a room', function(done){
        var client = new apiA.specHelper.connection();
        client.rooms.length.should.equal(0);
        apiA.chatRoom.addMember(client.id, 'defaultRoom', function(error, didAdd){
          didAdd.should.equal(true);
          apiA.chatRoom.addMember(client.id, 'defaultRoom', function(error, didAdd){
            error.should.equal('connection already in this room (defaultRoom)');
            didAdd.should.equal(false);
            client.destroy();
            done();
          });
        });
      });

      it('will not add a member to a non-existant room', function(done){
        var client = new apiA.specHelper.connection();
        client.rooms.length.should.equal(0);
        apiA.chatRoom.addMember(client.id, 'newRoom', function(error, didAdd){
          error.should.equal('room does not exist');
          didAdd.should.equal(false);
          client.destroy();
          done();
        });
      });

      it('server will not remove a member not in a room', function(done){
        var client = new apiA.specHelper.connection();
        apiA.chatRoom.removeMember(client.id, 'defaultRoom', function(error, didRemove){
          didRemove.should.equal(false);
          client.destroy();
          done();
        });
      });

      it('server can remove connections to a room (local)', function(done){
        var client = new apiA.specHelper.connection();
        apiA.chatRoom.addMember(client.id, 'defaultRoom', function(error, didAdd){
          didAdd.should.equal(true);
          apiA.chatRoom.removeMember(client.id, 'defaultRoom', function(error, didRemove){
            didRemove.should.equal(true);
            client.destroy();
            done();
          });
        });
      });

      it('server can remove connections to a room (remote)', function(done){
        var client = new apiB.specHelper.connection();
        apiB.chatRoom.addMember(client.id, 'defaultRoom', function(error, didAdd){
          didAdd.should.equal(true);
          apiA.chatRoom.removeMember(client.id, 'defaultRoom', function(error, didRemove){
            didRemove.should.equal(true);
            client.destroy();
            done();
          });
        });
      });

      it('server can destroy a room and connections will be removed', function(done){
        var client = new apiA.specHelper.connection();
        apiA.chatRoom.add('newRoom', function(error){
          apiA.chatRoom.addMember(client.id, 'newRoom', function(error, didAdd){
            didAdd.should.equal(true);
            client.rooms[0].should.equal('newRoom');
            apiA.chatRoom.destroy('newRoom', function(error){
              client.rooms.length.should.equal(0);
              // TODO: testing for the recepit of this message is a race condition with room.destroy and boradcast in test
              // client.messages[1].message.should.equal('this room has been deleted');
              // client.messages[1].room.should.equal('newRoom');
              client.destroy();
              done();
            });
          });
        });
      });

      it('can get a list of room members', function(done){
        var client = new apiA.specHelper.connection();
        client.rooms.length.should.equal(0);
        apiA.chatRoom.addMember(client.id, 'defaultRoom', function(error, didAdd){
          apiA.chatRoom.roomStatus('defaultRoom', function(error, data){
            data.room.should.equal('defaultRoom');
            data.membersCount.should.equal(1);
            client.destroy();
            done();
          });
        });
      });

      describe('chat middleware', function(){

        var clientA;
        var clientB;
        var originalGenerateMessagePayload;

        beforeEach(function(done){
          originalGenerateMessagePayload = apiA.chatRoom.generateMessagePayload;
          clientA = new apiA.specHelper.connection();
          clientB = new apiA.specHelper.connection();

          done();
        });

        afterEach(function(done){
          apiA.chatRoom.middleware = {};
          apiA.chatRoom.globalMiddleware = [];

          clientA.destroy();
          clientB.destroy();

          apiA.chatRoom.generateMessagePayload = originalGenerateMessagePayload;
          setTimeout(function(){
            done();
          }, 100);
        });

        it('generateMessagePayload can be overloaded', function(done){
          apiA.chatRoom.generateMessagePayload = function(message){
            return {
              thing: 'stuff',
              room: message.connection.room,
              from: message.connection.id,
            };
          };

          clientA.verbs('roomAdd', 'defaultRoom', function(error, data){
            should.not.exist(error);
            clientB.verbs('roomAdd', 'defaultRoom', function(error, data){
              should.not.exist(error);
              clientA.verbs('say', ['defaultRoom', 'hi there'], function(error, data){
                setTimeout(function(){
                  var message = clientB.messages[(clientB.messages.length - 1)];
                  message.thing.should.equal('stuff');
                  should.not.exist(message.message);
                  done();
                }, 100);
              });
            });
          });
        });

        it('(join + leave) can add middleware to announce members', function(done){
          apiA.chatRoom.addMiddleware({
            name: 'add chat middleware',
            join: function(connection, room, callback){
              apiA.chatRoom.broadcast({}, room, 'I have entered the room: ' + connection.id, function(){
                callback();
              });
            }
          });

          apiA.chatRoom.addMiddleware({
            name: 'leave chat middleware',
            leave: function(connection, room, callback){
              apiA.chatRoom.broadcast({}, room, 'I have left the room: ' + connection.id, function(){
                callback();
              });
            }
          });

          clientA.verbs('roomAdd', 'defaultRoom', function(error){
            should.not.exist(error);
            clientB.verbs('roomAdd', 'defaultRoom', function(error){
              should.not.exist(error);
              clientB.verbs('roomLeave', 'defaultRoom', function(error){
                should.not.exist(error);

                setTimeout(function(){
                  clientA.messages.pop().message.should.equal('I have left the room: ' + clientB.id);
                  clientA.messages.pop().message.should.equal('I have entered the room: ' + clientB.id);

                  done();
                }, 100);

              });
            });
          });
        });

        it('(say) can modify message payloads', function(done){
          apiA.chatRoom.addMiddleware({
            name: 'chat middleware',
            say: function(connection, room, messagePayload, callback){
              if(messagePayload.from !== 0){
                messagePayload.message = 'something else';
              }
              callback(null, messagePayload);
            }
          });

          clientA.verbs('roomAdd', 'defaultRoom', function(error){
            should.not.exist(error);
            clientB.verbs('roomAdd', 'defaultRoom', function(error){
              should.not.exist(error);
              clientB.verbs('say', ['defaultRoom', 'something', 'awesome'], function(error){
                should.not.exist(error);

                setTimeout(function(){
                  var lastMessage = clientA.messages[(clientA.messages.length - 1)];
                  lastMessage.message.should.equal('something else');

                  done();
                }, 100);

              });
            });
          });
        });

        it('can add middleware in a particular order and will be passed modified messagePayloads', function(done){
          apiA.chatRoom.addMiddleware({
            name: 'chat middleware 1',
            priority: 1000,
            say: function(connection, room, messagePayload, callback){
              messagePayload.message = 'MIDDLEWARE 1';
              callback(null, messagePayload);
            }
          });

          apiA.chatRoom.addMiddleware({
            name: 'chat middleware 2',
            priority: 2000,
            say: function(connection, room, messagePayload, callback){
              messagePayload.message = messagePayload.message + ' MIDDLEWARE 2';
              callback(null, messagePayload);
            }
          });

          clientA.verbs('roomAdd', 'defaultRoom', function(error){
            clientB.verbs('roomAdd', 'defaultRoom', function(error){
              clientB.verbs('say', ['defaultRoom', 'something', 'awesome'], function(error){

                setTimeout(function(){
                  var lastMessage = clientA.messages[(clientA.messages.length - 1)];
                  lastMessage.message.should.equal('MIDDLEWARE 1 MIDDLEWARE 2');

                  done();
                }, 100);

              });
            });
          });
        });

        it('say middleware can block excecution', function(done){
          apiA.chatRoom.addMiddleware({
            name: 'chat middleware',
            say: function(connection, room, messagePayload, callback){
              callback(new Error('messages blocked'));
            }
          });

          clientA.verbs('roomAdd', 'defaultRoom', function(){
            clientB.verbs('roomAdd', 'defaultRoom', function(){
              clientB.verbs('say', ['defaultRoom', 'something', 'awesome'], function(){

                setTimeout(function(){
                  // welcome message is passed, no join/leave/or say messages
                  clientA.messages.length.should.equal(1);

                  done();
                }, 100);

              });
            });
          });
        });

        it('join middleware can block excecution', function(done){
          apiA.chatRoom.addMiddleware({
            name: 'chat middleware',
            join: function(connection, room, callback){
              callback(new Error('joining rooms blocked'));
            }
          });

          clientA.verbs('roomAdd', 'defaultRoom', function(error, didJoin){
            String(error).should.equal('Error: joining rooms blocked');
            didJoin.should.equal(false);
            clientA.rooms.length.should.equal(0);

            done();
          });
        });

        it('leave middleware can block excecution', function(done){
          apiA.chatRoom.addMiddleware({
            name: 'chat middleware',
            leave: function(connection, room, callback){
              callback(new Error('Hotel California'));
            }
          });

          clientA.verbs('roomAdd', 'defaultRoom', function(error, didJoin){
            should.not.exist(error);
            didJoin.should.equal(true);
            clientA.rooms.length.should.equal(1);
            clientA.rooms[0].should.equal('defaultRoom');

            clientA.verbs('roomLeave', 'defaultRoom', function(error, didLeave){
              String(error).should.equal('Error: Hotel California');
              didLeave.should.equal(false);
              clientA.rooms.length.should.equal(1);

              done();
            });
          });
        });

      });

    });

  });

});
