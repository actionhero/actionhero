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
}

var startAllServers = function(next){
  actionhero1.start({configChanges: configChanges[1]}, function(err, a1){
    actionhero2.start({configChanges: configChanges[2]}, function(err, a2){
      actionhero3.start({configChanges: configChanges[3]}, function(err, a3){
        apiA = a1;
        apiB = a2;
        apiC = a3;
        next();
      });
    });
  });
}

var stopAllServers = function(next){
  actionhero1.stop(function(){
    actionhero2.stop(function(){
      actionhero3.stop(function(){
        next();
      });
    });
  });
}

describe('Core: Action Cluster', function(){

  describe('servers', function(){

    before(function(done){
      startAllServers(function(){
        done();
      });
    })

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

        client1.verbs('roomAdd','defaultRoom');
        client2.verbs('roomAdd','defaultRoom');
        client3.verbs('roomAdd','defaultRoom');

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
        client1.verbs('roomView', 'defaultRoom', function(err, data){
          data.room.should.equal('defaultRoom');
          data.membersCount.should.equal(3);
          done();
        });
      });

      it('all connections can join the default room and client #2 can see them', function(done){
        client2.verbs('roomView', 'defaultRoom', function(err, data){
          data.room.should.equal('defaultRoom');
          data.membersCount.should.equal(3);
          done();
        });
      });

      it('all connections can join the default room and client #3 can see them', function(done){
        client3.verbs('roomView', 'defaultRoom', function(err, data){
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
          apiB.cache.load('test_key', function(err, value){
            value.should.equal('yay');
            done();
          })
        });
      });

      it('peer 3 deletes and peer 1 cannot read any more', function(done){
        apiC.cache.destroy('test_key', function(){
          apiA.cache.load('test_key', function(err, value){
            should.not.exist(value);
            done();
          })
        });
      });

    });

    describe('RPC', function(){

      afterEach(function(done){
        delete apiA.rpcTestMethod;
        delete apiB.rpcTestMethod;
        delete apiC.rpcTestMethod;
        done();
      })

      it('can call remote methods on all other servers in the cluster', function(done){
        var data = {};

        apiA.rpcTestMethod = function(arg1, arg2, next){
          data[1] = [arg1, arg2]; next();
        }
        apiB.rpcTestMethod = function(arg1, arg2, next){
          data[2] = [arg1, arg2]; next();
        }
        apiC.rpcTestMethod = function(arg1, arg2, next){
          data[3] = [arg1, arg2]; next();
        }

        apiA.redis.doCluster('api.rpcTestMethod', ['arg1', 'arg2'], null, function(err){
          should.not.exist(err);
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

      it('can call remote methods only on one other cluster who holds a specific connectionId', function(done){
        var client = new apiA.specHelper.connection();

        var data = {};
        apiA.rpcTestMethod = function(arg1, arg2, next){
          data[1] = [arg1, arg2]; next();
        }
        apiB.rpcTestMethod = function(arg1, arg2, next){
          throw new Error('should not be here');
        }
        apiC.rpcTestMethod = function(arg1, arg2, next){
          throw new Error('should not be here');
        }

        apiB.redis.doCluster('api.rpcTestMethod', ['arg1', 'arg2'], client.id, function(err){
          should.not.exist(err);
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

      it('failing RPC calls with a callback will have a failure callback', function(done){
        this.timeout(apiA.config.redis.rpcTimeout * 2);

        apiB.redis.doCluster('api.rpcTestMethod', [], 'A missing clientId', function(err){
          String(err).should.equal('Error: RPC Timeout');
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
        apiA.chatRoom.exists('defaultRoom', function(err, found){
          found.should.equal(true);
          done()
        });
      });

      it('can check if a room does not exist', function(done){
        apiA.chatRoom.exists('missingRoom', function(err, found){
          found.should.equal(false);
          done()
        });
      });

      it('server can create new room', function(done){
        var room = 'newRoom';
        apiA.chatRoom.exists(room, function(err, found){
          found.should.equal(false);
          apiA.chatRoom.add(room, function(err){
            apiA.chatRoom.exists(room, function(err, found){
              found.should.equal(true);
              done();
            });
          });
        });
      });

      it('server cannot create already existing room', function(done){
        apiA.chatRoom.add('defaultRoom', function(err){
          String(err).should.equal('room exists');
          done();
        });
      });

      it('server can add connections to a LOCAL room', function(done){
        var client = new apiA.specHelper.connection();
        client.rooms.length.should.equal(0);
        apiA.chatRoom.addMember(client.id, 'defaultRoom', function(err, didAdd){
          didAdd.should.equal(true);
          client.rooms[0].should.equal('defaultRoom');
          client.destroy();
          done();
        });
      });

      it('server can add connections to a REMOTE room', function(done){
        var client = new apiB.specHelper.connection();
        client.rooms.length.should.equal(0);
        apiA.chatRoom.addMember(client.id, 'defaultRoom', function(err, didAdd){
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
        apiA.chatRoom.addMember(client.id, 'defaultRoom', function(err, didAdd){
          didAdd.should.equal(true);
          apiA.chatRoom.addMember(client.id, 'defaultRoom', function(err, didAdd){
            err.should.equal('connection already in this room');
            didAdd.should.equal(false);
            client.destroy();
            done();
          });
        });
      });

      it('will not add a member to a non-existant room', function(done){
        var client = new apiA.specHelper.connection();
        client.rooms.length.should.equal(0);
        apiA.chatRoom.addMember(client.id, 'newRoom', function(err, didAdd){
          err.should.equal('room does not exist');
          didAdd.should.equal(false);
          client.destroy();
          done();
        });
      });

      it('can add authorized members to secure rooms', function(done){
        var client = new apiA.specHelper.connection();
        apiA.chatRoom.add('newRoom', function(err){
          apiA.chatRoom.setAuthenticationPattern('newRoom', 'auth', true, function(err){
            client.auth = true;
            apiA.chatRoom.addMember(client.id, 'newRoom', function(err, didAdd){
              didAdd.should.equal(true);
              client.destroy();
              done();
            });
          });
        });
      });

      it('will not add a member with bad auth to a secure room', function(done){
        var client = new apiA.specHelper.connection();
        apiA.chatRoom.add('newRoom', function(err){
          apiA.chatRoom.setAuthenticationPattern('newRoom', 'auth', true, function(err){
            client.auth = false;
            apiA.chatRoom.addMember(client.id, 'newRoom', function(err, didAdd){
              didAdd.should.equal(false);
              client.destroy();
              done();
            });
          });
        });
      })

      it('server will not remove a member not in a room', function(done){
        var client = new apiA.specHelper.connection();
        apiA.chatRoom.removeMember(client.id, 'defaultRoom', function(err, didRemove){
          didRemove.should.equal(false);
          client.destroy();
          done();
        });
      });

      it('server can remove connections to a room (local)', function(done){
        var client = new apiA.specHelper.connection();
        apiA.chatRoom.addMember(client.id, 'defaultRoom', function(err, didAdd){
          didAdd.should.equal(true);
          apiA.chatRoom.removeMember(client.id, 'defaultRoom', function(err, didRemove){
            didRemove.should.equal(true);
            client.destroy();
            done();
          });
        });
      });

      it('server can remove connections to a room (remote)', function(done){
        var client = new apiB.specHelper.connection();
        apiB.chatRoom.addMember(client.id, 'defaultRoom', function(err, didAdd){
          didAdd.should.equal(true);
          apiA.chatRoom.removeMember(client.id, 'defaultRoom', function(err, didRemove){
            didRemove.should.equal(true);
            client.destroy();
            done();
          });
        });
      });
      
      it('server can destroy a room and connections will be removed', function(done){
        var client = new apiA.specHelper.connection();
        apiA.chatRoom.add('newRoom', function(err){
          apiA.chatRoom.addMember(client.id, 'newRoom', function(err, didAdd){
            didAdd.should.equal(true);
            client.rooms[0].should.equal('newRoom');
            apiA.chatRoom.destroy('newRoom', function(err){
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
        apiA.chatRoom.addMember(client.id, 'defaultRoom', function(err, didAdd){
          apiA.chatRoom.roomStatus('defaultRoom', function(err, data){
            data.room.should.equal('defaultRoom');
            data.membersCount.should.equal(1);
            client.destroy();
            done();
          });            
        });
      })

      it('can authorize clients against rooms PASSING', function(done){
        var client = new apiA.specHelper.connection();
        client.auth = true;
        apiA.chatRoom.add('newRoom', function(err){
          apiA.chatRoom.setAuthenticationPattern('newRoom', 'auth', true, function(err){
            apiA.chatRoom.authorize(client, 'newRoom', function(err, authed){
              should.not.exist(err);
              authed.should.equal(true);
              client.destroy();
              done();
            });
          });
        });
      });

      it('can authorize clients against rooms FAILING', function(done){
        var client = new apiA.specHelper.connection();
        client.auth = false;
        apiA.chatRoom.add('newRoom', function(err){
          apiA.chatRoom.setAuthenticationPattern('newRoom', 'auth', true, function(err){
            apiA.chatRoom.authorize(client, 'newRoom', function(err, authed){
              should.not.exist(err);
              authed.should.equal(false);
              client.destroy();
              done();
            });
          });
        });
      });

      it('server change auth for a room and all connections will be checked', function(done){
        var clientA = new apiA.specHelper.connection();
        var clientB = new apiA.specHelper.connection();
        clientA.auth = true;
        clientA._name = 'a';
        clientB.auth = false;
        clientB._name = 'b';
        apiA.chatRoom.add('newRoom', function(err){
          apiA.chatRoom.addMember(clientA.id, 'newRoom', function(err, didAdd){
            apiA.chatRoom.addMember(clientB.id, 'newRoom', function(err, didAdd){
              clientA.rooms[0].should.equal('newRoom');
              clientB.rooms[0].should.equal('newRoom');
              apiA.chatRoom.setAuthenticationPattern('newRoom', 'auth', true, function(err){
                should.not.exist(err);
                clientA.rooms[0].should.equal('newRoom');
                clientA.rooms.length.should.equal(1);
                clientB.rooms.length.should.equal(0);
                clientA.destroy();
                clientB.destroy();
                done();
              });
            });
          });
        });
      });

    });

  });

});
