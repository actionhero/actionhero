describe('Core: actionCluster', function(){
  var specHelper = require('../helpers/specHelper.js').specHelper;
  var apis = [];
  var should = require("should");
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
        api.id.should.equal("test-server-1");
        apis[0] = api;
        done();
      });
    });

    it('Start cluster server #2', function(done){
      this.timeout(5000);
      specHelper.prepare(1, function(api){ 
        api.should.be.an.instanceOf(Object);
        api.id.should.be.a('string');
        api.id.should.equal("test-server-2");
        apis[1] = api;
        done();
      });
    });

    it('Start cluster server #3', function(done){
      this.timeout(5000);
      specHelper.prepare(2, function(api){ 
        api.should.be.an.instanceOf(Object);
        api.id.should.be.a('string');
        api.id.should.equal("test-server-3");
        apis[2] = api;
        done();
      });
    });

    it("Peer #1 can see all other peers in the cluster", function(done){
    apis[0].redis.client.llen("actionHero:peers", function(err, length){
      apis[0].redis.client.lrange("actionHero:peers", 0, length, function(err, peers){
        peers.should.include("test-server-1");
        peers.should.include("test-server-2");
        peers.should.include("test-server-3");
        done();
      });
    });
    });

    it("Peer #2 can see all other peers in the cluster", function(done){
    apis[1].redis.client.llen("actionHero:peers", function(err, length){
      apis[1].redis.client.lrange("actionHero:peers", 0, length, function(err, peers){
        peers.should.include("test-server-1");
        peers.should.include("test-server-2");
        peers.should.include("test-server-3");
        done();
      });
    });
    });

    it("Peer #3 can see all other peers in the cluster", function(done){
    apis[2].redis.client.llen("actionHero:peers", function(err, length){
      apis[2].redis.client.lrange("actionHero:peers", 0, length, function(err, peers){
         peers.should.include("test-server-1");
         peers.should.include("test-server-2");
         peers.should.include("test-server-3");
        done();
      });
    });
    });
  
  });

  describe("reconnection and peers", function(){

    after(function(done){
      this.timeout(10000);
      restartAllServers(done);
    });

    it("cluster members notice when a peer goes away", function(done){
      specHelper.stopServer(1, function(){
        specHelper.stopServer(2, function(){
          apis[0].redis.client.llen("actionHero:peers", function(err, length){
          apis[0].redis.client.lrange("actionHero:peers", 0, length, function(err, peers){
            peers.length.should.equal(1);
            peers.should.include("test-server-1");
            peers.should.not.include("test-server-2");
            peers.should.not.include("test-server-3");
            done();
          });
        });
        });
      });
    });

    it("Peer #1 can see all other peers in the cluster again", function(done){
      this.timeout(5000);
      specHelper.restartServer(1, function(api){
        apis[1] = api;
        specHelper.restartServer(2, function(api){
          apis[2] = api;
          apis[0].redis.client.llen("actionHero:peers", function(err, length){
            apis[0].redis.client.lrange("actionHero:peers", 0, length, function(err, peers){
              peers.should.include("test-server-1");
              peers.should.include("test-server-2");
              peers.should.include("test-server-3");
              done();
            });
          });
        });
      });
    });

    it("Peer #2 can see all other peers in the cluster again", function(done){
      this.timeout(5000);
      apis[1].redis.client.llen("actionHero:peers", function(err, length){
        apis[1].redis.client.lrange("actionHero:peers", 0, length, function(err, peers){
          peers.should.include("test-server-1");
          peers.should.include("test-server-2");
          peers.should.include("test-server-3");
          done();
        });
      });
    });

    it("Peer #3 can see all other peers in the cluster again", function(done){
      this.timeout(5000);
      apis[2].redis.client.llen("actionHero:peers", function(err, length){
        apis[2].redis.client.lrange("actionHero:peers", 0, length, function(err, peers){
          peers.should.include("test-server-1");
          peers.should.include("test-server-2");
          peers.should.include("test-server-3");
          done();
        });
      });
    });

    describe('destructive stop', function(){

      before(function(done){
        clearTimeout(apis[2].redis.pingTimer);
        apis[2].running = false;
        done();
      });

      it("If a peer goes away, it should be removed from the list of peers (ping)", function(done){
        this.timeout(20000);
        var sleepTime = (apis[0].redis.lostPeerCheckTime * 2) + 1;
        setTimeout(function(){
          apis[0].redis.checkForDroppedPeers(function(){
            apis[0].redis.client.hgetall("actionHero:peerPings", function (err, peerPings){
              apis[0].redis.client.llen("actionHero:peers", function(err, length){
                apis[0].redis.client.lrange("actionHero:peers", 0, length, function(err, peers){
                  var count = 0;
                  for (var i in peerPings){
                    count++;
                  }
                  count.should.equal(2);
                  peers.length.should.equal(2);
                  done();
                });
              });
            });
          });
        }, sleepTime );
      });

      after(function(done){
        apis[2].running = true;
        done();
      })

    });

  });

  describe('say and clients on seperate peers', function(){
    var client1 = {};
    var client2 = {};
    var client3 = {};
    var net = require('net');

    function makeSocketRequest(thisClient, message, cb){
      var rsp = function(d){ 
        d = d.split("\r\n")[0]
        try{
          var parsed = JSON.parse(d);
        }catch(e){
          console.log("Error Parsing:")
          console.log(d)
          console.log(typeof d)
          console.log(e)
          process.exit()
        }
        thisClient.removeListener('data', rsp); 
        cb(parsed); 
      };
      thisClient.on('data', rsp);
      thisClient.write(message + "\r\n");
    };

    before(function(done){
      var connections = 0;
      var connnectedClient = function(){
        connections++;
        if(connections == 3){
          client1.removeListener('data', connnectedClient);
          client2.removeListener('data', connnectedClient);
          client3.removeListener('data', connnectedClient);
          setTimeout(done, 100); // time for streaming bufferst to clear
        }
      };

      client1 = net.connect(specHelper.params[0].servers.socket.port);
      client1.setEncoding('utf8');
      client1.on("data", connnectedClient);

      client2 = net.connect(specHelper.params[1].servers.socket.port);
      client2.setEncoding('utf8');
      client2.on("data", connnectedClient);

      client3 = net.connect(specHelper.params[2].servers.socket.port);
      client3.setEncoding('utf8');
      client3.on("data", connnectedClient);
    });

    after(function(done){
      client1.destroy();
      client2.destroy();
      client3.destroy();
      setTimeout(function(){
        done();
      }, 500)
    });

    it("all connections should be in the default room and client #1 can see them", function(done){
      this.timeout(10000)
      makeSocketRequest(client1, "roomView", function(response){
        response.should.be.an.instanceOf(Object);
        response.data.room.should.equal('defaultRoom');
        response.data.members.length.should.equal(3);
        done();
      });
    });

    it("all connections should be in the default room and client #2 can see them", function(done){
      this.timeout(10000)
      makeSocketRequest(client2, "roomView", function(response){
        response.should.be.an.instanceOf(Object);
        response.data.room.should.equal('defaultRoom');
        response.data.members.length.should.equal(3);
        done();
      });
    });

    it("all connections should be in the default room and client #3 can see them", function(done){
      this.timeout(10000)
      makeSocketRequest(client3, "roomView", function(response){
        response.should.be.an.instanceOf(Object);
        response.data.room.should.equal('defaultRoom');
        response.data.members.length.should.equal(3);
        done();
      });
    });

    it("clients can communicate across the cluster", function(done){
      this.timeout(5000);
      if(apis[0].configData.redis.fake == true){
        // you can't communicte across the cluster with fakeredis!
        done();
      }else{
        makeSocketRequest(client2, "", function(response){
          response.message.should.equal("Hi there!");
          done();
        });
        client1.write("say Hi there!" + "\r\n");
      }
    });

  });

  describe('shared cache', function(){

    it("peer 1 writes and peer 2 should read", function(done){
      apis[0].cache.save("test_key", "yay", null, function(err, save_resp){
        apis[1].cache.load("test_key", function(err, value){
          value.should.equal('yay');
          done();
        })
      });
    }); 

    it("peer 3 deletes and peer 1 cannot read any more", function(done){
      apis[2].cache.destroy("test_key", function(err, del_resp){
        apis[0].cache.load("test_key", function(err, value){
          should.not.exist(value);
          done();
        })
      });
    });

  });

});
