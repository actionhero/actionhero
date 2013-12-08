describe('Core: actionCluster', function(){
  var specHelper = require(__dirname + '/_specHelper.js').specHelper;
  var apis = [];
  var should = require('should');
  var externalIP = 'actionHero';

  var startAllServers = function(done){
    specHelper.startServer(0, function(){
      specHelper.startServer(1, function(){
        specHelper.startServer(2, function(){
          done();
        });
      });
    });
  }

  var stopAllServers = function(done){
    specHelper.stopServer(0, function(){
      specHelper.stopServer(1, function(){
        specHelper.stopServer(2, function(){
          done();
        });
      });
    });
  }

  var restartAllServers = function(done){
    specHelper.restartServer(0, function(api){
      apis[0] = api;
      specHelper.restartServer(1, function(api){
        apis[1] = api;
        specHelper.restartServer(2, function(api){
          apis[2] = api;
          done();
        });
      });
    });
  }

  before(function(done){
    this.timeout(5000);
    stopAllServers(function(){
      setTimeout(done, 1000);
    });
  });

  after(function(done){
    this.timeout(10000);
    stopAllServers(function(){
      setTimeout(done, 1000);
    });
  });

  describe('general actionCluster', function(){

    it('Start cluster server #1', function(done){
      this.timeout(5000);
      specHelper.prepare(0, function(api){
        api.should.be.an.instanceOf(Object);
        api.id.should.be.a('string');
        api.id.should.equal('test-server-1');
        apis[0] = api;
        done();
      });
    });

    it('Start cluster server #2', function(done){
      this.timeout(5000);
      specHelper.prepare(1, function(api){
        api.should.be.an.instanceOf(Object);
        api.id.should.be.a('string');
        api.id.should.equal('test-server-2');
        apis[1] = api;
        done();
      });
    });

    it('Start cluster server #3', function(done){
      this.timeout(5000);
      specHelper.prepare(2, function(api){
        api.should.be.an.instanceOf(Object);
        api.id.should.be.a('string');
        api.id.should.equal('test-server-3');
        apis[2] = api;
        done();
      });
    });
  
  });

  describe('say and clients on separate peers', function(){
    var client1 = {};
    var client2 = {};
    var client3 = {};
    var net = require('net');

    var makeSocketRequest = function(thisClient, message, cb){
      var rsp = function(d){
        d = d.split('\r\n')[0]
        var parsed = null;
        try {
          parsed = JSON.parse(d);
        } catch(e){
          console.log('Error Parsing:')
          console.log(d)
          console.log(typeof d)
          console.log(e)
          process.exit()
        }
        thisClient.removeListener('data', rsp);
        if(typeof cb == 'function'){ cb(parsed) }
      };
      thisClient.on('data', rsp);
      thisClient.write(message + '\r\n');
    };

    before(function(done){
      var connections = 0;
      var connectedClient = function(){
        connections++;
        if(connections == 3){
          client1.removeListener('data', connectedClient);
          client2.removeListener('data', connectedClient);
          client3.removeListener('data', connectedClient);
          setTimeout(done, 100); // time for streaming buffers to clear
        }
      };

      client1 = net.connect((specHelper.startingSocketPort + 0));
      client1.setEncoding('utf8');
      client1.on('data', connectedClient);
      makeSocketRequest(client1, 'roomChange defaultRoom');

      client2 = net.connect((specHelper.startingSocketPort + 1));
      client2.setEncoding('utf8');
      client2.on('data', connectedClient);
      makeSocketRequest(client2, 'roomChange defaultRoom');

      client3 = net.connect((specHelper.startingSocketPort + 2));
      client3.setEncoding('utf8');
      client3.on('data', connectedClient);
      makeSocketRequest(client3, 'roomChange defaultRoom');
    });

    after(function(done){
      client1.destroy();
      client2.destroy();
      client3.destroy();
      setTimeout(function(){
        done();
      }, 500)
    });

    it('all connections can join the default room and client #1 can see them', function(done){
      this.timeout(10000)
      makeSocketRequest(client1, 'roomView', function(response){
        response.should.be.an.instanceOf(Object);
        response.data.room.should.equal('defaultRoom');
        response.data.membersCount.should.equal(3);
        done();
      });
    });

    it('all connections can join the default room and client #2 can see them', function(done){
      this.timeout(10000)
      makeSocketRequest(client2, 'roomView', function(response){
        response.should.be.an.instanceOf(Object);
        response.data.room.should.equal('defaultRoom');
        response.data.membersCount.should.equal(3);
        done();
      });
    });

    it('all connections can join the default room and client #3 can see them', function(done){
      this.timeout(10000)
      makeSocketRequest(client3, 'roomView', function(response){
        response.should.be.an.instanceOf(Object);
        response.data.room.should.equal('defaultRoom');
        response.data.membersCount.should.equal(3);
        done();
      });
    });

    it('clients can communicate across the cluster', function(done){
      this.timeout(5000);
      if(apis[0].config.redis.fake == true){
        // you can't communicate across the cluster with fakeredis!
        done();
      } else {
        makeSocketRequest(client2, '', function(response){
          response.message.should.equal('Hi there!');
          done();
        });
        client1.write('say Hi there!' + '\r\n');
      }
    });

  });

  describe('shared cache', function(){

    it('peer 1 writes and peer 2 should read', function(done){
      apis[0].cache.save('test_key', 'yay', null, function(err, save_resp){
        apis[1].cache.load('test_key', function(err, value){
          value.should.equal('yay');
          done();
        })
      });
    });

    it('peer 3 deletes and peer 1 cannot read any more', function(done){
      apis[2].cache.destroy('test_key', function(err, del_resp){
        apis[0].cache.load('test_key', function(err, value){
          should.not.exist(value);
          done();
        })
      });
    });

  });

});
