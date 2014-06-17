var should = require('should');
var actionheroPrototype = require(__dirname + "/../../actionhero.js").actionheroPrototype;

var actionhero1 = new actionheroPrototype();
var actionhero2 = new actionheroPrototype();
var actionhero3 = new actionheroPrototype();

var api_1;
var api_2;
var api_3;

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
        api_1 = a1;
        api_2 = a2;
        api_3 = a3;
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

var restartAllServers = function(next){
  actionhero1.restart(function(err, a1){
    actionhero2.restart(function(err, a2){
      actionhero3.restart(function(err, a3){
        api_1 = a1;
        api_2 = a2;
        api_3 = a3;
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
        client1 = new api_1.specHelper.connection();
        client2 = new api_2.specHelper.connection();
        client3 = new api_3.specHelper.connection();

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
        api_1.cache.save('test_key', 'yay', null, function(err, save_resp){
          api_2.cache.load('test_key', function(err, value){
            value.should.equal('yay');
            done();
          })
        });
      });

      it('peer 3 deletes and peer 1 cannot read any more', function(done){
        api_3.cache.destroy('test_key', function(err, del_resp){
          api_1.cache.load('test_key', function(err, value){
            should.not.exist(value);
            done();
          })
        });
      });

    });

    describe('RPC', function(){

      afterEach(function(done){
        delete api_1.rpcTestMethod;
        delete api_2.rpcTestMethod;
        delete api_3.rpcTestMethod;
        done();
      })

      it('can call remote methods on all other servers in the cluster', function(done){
        var data = {};

        api_1.rpcTestMethod = function(arg1, arg2, next){
          data[1] = [arg1, arg2]; next();
        }
        api_2.rpcTestMethod = function(arg1, arg2, next){
          data[2] = [arg1, arg2]; next();
        }
        api_3.rpcTestMethod = function(arg1, arg2, next){
          data[3] = [arg1, arg2]; next();
        }

        api_1.redis.doCluster('api.rpcTestMethod', ['arg1', 'arg2'], null, function(err){
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
        var client = new api_1.specHelper.connection();

        var data = {};
        api_1.rpcTestMethod = function(arg1, arg2, next){
          data[1] = [arg1, arg2]; next();
        }
        api_2.rpcTestMethod = function(arg1, arg2, next){
          throw new Error('should not be here');
        }
        api_3.rpcTestMethod = function(arg1, arg2, next){
          throw new Error('should not be here');
        }

        api_2.redis.doCluster('api.rpcTestMethod', ['arg1', 'arg2'], client.id, function(err){
          should.not.exist(err);
          data[1][0].should.equal('arg1');
          data[1][1].should.equal('arg2');
          client.destroy();
          done();
        });
      });

      it('can get information about connections connected to other servers', function(done){
        var client = new api_1.specHelper.connection();

        api_2.connections.apply(client.id, function(connection){
          connection.id.should.equal(client.id);
          connection.type.should.equal('testServer');
          connection.canChat.should.equal(true);
          done();
        });
      });

      it('can call remote methods on/about connections connected to other servers', function(done){
        var client = new api_1.specHelper.connection();
        should.not.exist(client.auth);

        api_2.connections.apply(client.id, 'set', ['auth', true], function(connection){
          connection.id.should.equal(client.id);
          client.auth.should.equal(true);
          client.destroy();
          done();
        });
      });

      it('failing RPC calls with a callback will have a failure callback', function(done){
        this.timeout(api_1.config.redis.rpcTimeout * 2);

        api_2.redis.doCluster('api.rpcTestMethod', [], 'A missing clientId', function(err){
          String(err).should.equal('Error: RPC Timeout');
          done();
        });
      });

    });

    describe('chat', function(){

      afterEach(function(done){
        api_1.chatRoom.destroy('newRoom', function(){
          done();
        });
      });

      it('can check if rooms exist', function(done){
        api_1.chatRoom.exists('defaultRoom', function(err, found){
          found.should.equal(true);
          done()
        });
      });

      it('can check if a room does not exist', function(done){
        api_1.chatRoom.exists('missingRoom', function(err, found){
          found.should.equal(false);
          done()
        });
      });

      it('server can create new room', function(done){
        var room = 'newRoom';
        api_1.chatRoom.exists(room, function(err, found){
          found.should.equal(false);
          api_1.chatRoom.add(room, function(err){
            api_1.chatRoom.exists(room, function(err, found){
              found.should.equal(true);
              done();
            });
          });
        });
      });

      it('server cannot create already existing room', function(done){
        api_1.chatRoom.add('defaultRoom', function(err){
          String(err).should.equal('room exists');
          done();
        });
      });

      it('server can add connections to a LOCAL room', function(done){
        var client = new api_1.specHelper.connection();
        client.rooms.length.should.equal(0);
        api_1.chatRoom.addMember(client.id, 'defaultRoom', function(err, didAdd){
          didAdd.should.equal(true);
          client.rooms[0].should.equal('defaultRoom');
          client.destroy();
          done();
        });
      });

      it('server can add connections to a REMOTE room', function(done){
        var client = new api_2.specHelper.connection();
        client.rooms.length.should.equal(0);
        api_1.chatRoom.addMember(client.id, 'defaultRoom', function(err, didAdd){
          didAdd.should.equal(true);
          client.rooms.length.should.equal(1);
          client.rooms[0].should.equal('defaultRoom');
          client.destroy();
          done();
        });
      });

      it('will not re-add a member to a room', function(done){
        var client = new api_1.specHelper.connection();
        client.rooms.length.should.equal(0);
        api_1.chatRoom.addMember(client.id, 'defaultRoom', function(err, didAdd){
          didAdd.should.equal(true);
          api_1.chatRoom.addMember(client.id, 'defaultRoom', function(err, didAdd){
            err.should.equal('connection already in this room');
            didAdd.should.equal(false);
            client.destroy();
            done();
          });
        });
      });

      it('will not add a member to a non-existant room', function(done){
        var client = new api_1.specHelper.connection();
        client.rooms.length.should.equal(0);
        api_1.chatRoom.addMember(client.id, 'newRoom', function(err, didAdd){
          err.should.equal('room does not exist');
          didAdd.should.equal(false);
          client.destroy();
          done();
        });
      });

      it('can add authorized members to secure rooms', function(done){
        var client = new api_1.specHelper.connection();
        api_1.chatRoom.add('newRoom', function(err){
          api_1.chatRoom.setAuthenticationPattern('newRoom', 'auth', true, function(err){
            client.auth = true;
            api_1.chatRoom.addMember(client.id, 'newRoom', function(err, didAdd){
              didAdd.should.equal(true);
              client.destroy();
              done();
            });
          });
        });
      });

      it('will not add a member with bad auth to a secure room', function(done){
        var client = new api_1.specHelper.connection();
        api_1.chatRoom.add('newRoom', function(err){
          api_1.chatRoom.setAuthenticationPattern('newRoom', 'auth', true, function(err){
            client.auth = false;
            api_1.chatRoom.addMember(client.id, 'newRoom', function(err, didAdd){
              didAdd.should.equal(false);
              client.destroy();
              done();
            });
          });
        });
      })

      it('server will not remove a member not in a room', function(done){
        var client = new api_1.specHelper.connection();
        api_1.chatRoom.removeMember(client.id, 'defaultRoom', function(err, didRemove){
          didRemove.should.equal(false);
          client.destroy();
          done();
        });
      });

      it('server can remove connections to a room (local)', function(done){
        var client = new api_1.specHelper.connection();
        api_1.chatRoom.addMember(client.id, 'defaultRoom', function(err, didAdd){
          didAdd.should.equal(true);
          api_1.chatRoom.removeMember(client.id, 'defaultRoom', function(err, didRemove){
            didRemove.should.equal(true);
            client.destroy();
            done();
          });
        });
      });

      it('server can remove connections to a room (remote)', function(done){
        var client = new api_2.specHelper.connection();
        api_2.chatRoom.addMember(client.id, 'defaultRoom', function(err, didAdd){
          didAdd.should.equal(true);
          api_1.chatRoom.removeMember(client.id, 'defaultRoom', function(err, didRemove){
            didRemove.should.equal(true);
            client.destroy();
            done();
          });
        });
      });
      
      it('server can destroy a room and connections will be removed', function(done){
        var client = new api_1.specHelper.connection();
        api_1.chatRoom.add('newRoom', function(err){
          api_1.chatRoom.addMember(client.id, 'newRoom', function(err, didAdd){
            didAdd.should.equal(true);
            client.rooms[0].should.equal('newRoom');
            api_1.chatRoom.destroy('newRoom', function(err){
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
        var client = new api_1.specHelper.connection();
        client.rooms.length.should.equal(0);
        api_1.chatRoom.addMember(client.id, 'defaultRoom', function(err, didAdd){
          api_1.chatRoom.roomStatus('defaultRoom', function(err, data){
            data.room.should.equal('defaultRoom');
            data.membersCount.should.equal(1);
            client.destroy();
            done();
          });            
        });
      })

      it('can authorize clients against rooms PASSING', function(done){
        var client = new api_1.specHelper.connection();
        client.auth = true;
        api_1.chatRoom.add('newRoom', function(err){
          api_1.chatRoom.setAuthenticationPattern('newRoom', 'auth', true, function(err){
            api_1.chatRoom.authorize(client, 'newRoom', function(err, authed){
              should.not.exist(err);
              authed.should.equal(true);
              client.destroy();
              done();
            });
          });
        });
      });

      it('can authorize clients against rooms FAILING', function(done){
        var client = new api_1.specHelper.connection();
        client.auth = false;
        api_1.chatRoom.add('newRoom', function(err){
          api_1.chatRoom.setAuthenticationPattern('newRoom', 'auth', true, function(err){
            api_1.chatRoom.authorize(client, 'newRoom', function(err, authed){
              should.not.exist(err);
              authed.should.equal(false);
              client.destroy();
              done();
            });
          });
        });
      });

      it('server change auth for a room and all connections will be checked', function(done){
        var clientA = new api_1.specHelper.connection();
        var clientB = new api_1.specHelper.connection();
        clientA.auth = true;
        clientB.auth = false;
        api_1.chatRoom.add('newRoom', function(err){
          api_1.chatRoom.addMember(clientA.id, 'newRoom', function(err, didAdd){
            api_1.chatRoom.addMember(clientB.id, 'newRoom', function(err, didAdd){
              clientA.rooms[0].should.equal('newRoom');
              clientB.rooms[0].should.equal('newRoom');
              api_1.chatRoom.setAuthenticationPattern('newRoom', 'auth', true, function(err){
                clientA.rooms[0].should.equal('newRoom');
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
