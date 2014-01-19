var should = require('should');
var actionheroPrototype = require(__dirname + "/../../actionhero.js").actionheroPrototype;

var actionhero1 = new actionheroPrototype();
var actionhero2 = new actionheroPrototype();
var actionhero3 = new actionheroPrototype();

var api_1;
var api_2;
var api_3;

var client1;
var client2;
var client3;

var configChanges = {
  1: {
    general: {id: 'test-server-1'},
    servers: {web: null, socket: null, websocket: null}
  },
  2: {
    general: {id: 'test-server-2'},
    servers: {web: null, socket: null, websocket: null}
  },
  3: {
    general: {id: 'test-server-3'},
    servers: {web: null, socket: null, websocket: null}
  }
}

var startAllServers = function(next){
  actionhero1.start({configChanges: configChanges[1]}, function(a1){
    actionhero2.start({configChanges: configChanges[2]}, function(a2){
      actionhero3.start({configChanges: configChanges[3]}, function(a3){
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
  actionhero1.restart(function(a1){
    actionhero2.restart(function(a2){
      actionhero3.restart(function(a3){
        api_1 = a1;
        api_2 = a2;
        api_3 = a3;
        next();
      });
    });
  });
}

describe('Core: Action Cluster', function(){

  before(function(done){
    done();
  });

  after(function(done){
    stopAllServers(function(){
      done();
    });
  });

  describe('general actionCluster', function(){

    it('Start cluster server #1', function(done){
      actionhero1.start({configChanges: configChanges[1]}, function(err, api){
        api.should.be.an.Object;
        api.id.should.equal('test-server-1');
        api_1 = api;
        done();
      });
    });

    it('Start cluster server #2', function(done){
      actionhero2.start({configChanges: configChanges[2]}, function(err, api){
        api.should.be.an.Object;
        api.id.should.equal('test-server-2');
        api_2 = api;
        done();
      });
    });

    it('Start cluster server #3', function(done){
      actionhero3.start({configChanges: configChanges[3]}, function(err, api){
        api.should.be.an.Object;
        api.id.should.equal('test-server-3');
        api_3 = api;
        done();
      });
    });
  
  });

  describe('say and clients on separate peers', function(){


    before(function(done){

      client1 = new api_1.specHelper.connection();
      client2 = new api_2.specHelper.connection();
      client3 = new api_3.specHelper.connection();

      client1.verbs('roomChange','defaultRoom');
      client2.verbs('roomChange','defaultRoom');
      client3.verbs('roomChange','defaultRoom');

      setTimeout(function(){
        done();
      }, 500);
    });

    after(function(done){
      client1.destroy();
      client2.destroy();
      client3.destroy();
      setTimeout(function(){
        done();
      }, 500);
    });

    it('all connections can join the default room and client #1 can see them', function(done){
      client1.verbs('roomView', function(err, data){
        data.room.should.equal('defaultRoom');
        data.membersCount.should.equal(3);
        done();
      });
    });

    it('all connections can join the default room and client #2 can see them', function(done){
      client2.verbs('roomView', function(err, data){
        data.room.should.equal('defaultRoom');
        data.membersCount.should.equal(3);
        done();
      });
    });

    it('all connections can join the default room and client #3 can see them', function(done){
      client3.verbs('roomView', function(err, data){
        data.room.should.equal('defaultRoom');
        data.membersCount.should.equal(3);
        done();
      });
    });

    it('clients can communicate across the cluster', function(done){
      if(api_1.config.redis.fake == true){
        // you can't communicate across the cluster with fakeredis!
        done();
      } else {
        client1.verbs('say', 'Hi from client 1', function(){
          setTimeout(function(){
            var message = client2.messages[(client2.messages.length - 1)];
            message.message.should.equal('Hi from client 1');
            message.room.should.equal('defaultRoom');
            message.from.should.equal(client1.id);
            done();
          }, 500);
        });
      }
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

});
