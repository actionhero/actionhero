describe('Client: Web Sockets', function(){
  var specHelper = require('../helpers/specHelper.js').specHelper;
  var apiObj = {};
  var should = require("should");
  var socketURL = "http://localhost:9000";
  var faye = require("faye");
  var actionHeroWebSocket = require(process.cwd() + "/public/javascript/actionHeroWebSocket.js").actionHeroWebSocket;
  var client_1 = new actionHeroWebSocket({host: socketURL, faye: faye});
  var client_2 = new actionHeroWebSocket({host: socketURL, faye: faye});
  var client_3 = new actionHeroWebSocket({host: socketURL, faye: faye});

  function countWebSocketConnections(){
    var found = 0;
    for(var i in apiObj.connections.connections){
      if(apiObj.connections.connections[i].type == "webSocket"){
        found++;
      }
    }
    return found;
  }

  before(function(done){
    specHelper.prepare(0, function(api){ 
      api.redis.client.flushdb(function(){
        apiObj = api;
        done();
      });
    })
  });

  it('faye should work in general', function(done){
    var client = new faye.Client(socketURL + "/faye");
    client.subscribe('/test', function(message){
      message.message.should.equal('hello');
      done();
    });

    setTimeout(function(){
      apiObj.faye.client.publish("/test", {message: 'hello'});
    }, 500);
  });

  it('socket client connections should work: client 1', function(done){
    client_1.connect(function(err, data){
      data.should.be.an.instanceOf(Object);
      data.context.should.equal("response");
      data.details.room.should.equal("defaultRoom");
      data.details.totalActions.should.equal(0);
      done();
    });
  });

  it('socket client connections should work: client 2', function(done){
    client_2.connect(function(err, data){
      data.should.be.an.instanceOf(Object);
      data.context.should.equal("response");
      data.details.room.should.equal("defaultRoom");
      data.details.totalActions.should.equal(0);
      done();
    });
  });

  it('Other clients should have been told about people entering the room', function(done){
    client_3.connect(function(err, data){
      data.should.be.an.instanceOf(Object);
      data.context.should.equal("response");
      data.details.room.should.equal("defaultRoom");
      data.details.totalActions.should.equal(0);
      done();
    });
  });

  it('I can get my connection details', function(done){
    client_1.detailsView(function(response){
      response.should.be.an.instanceOf(Object);
      response.status.should.equal("OK")
      response.details.connectedAt.should.be.within(0, new Date().getTime())
      response.details.room.should.equal("defaultRoom")
      done()
    });
  });

  it('Clients can talk to each other', function(done){
    client_1.events.say = function(response){
      delete client_1.events.say;
      response.should.be.an.instanceOf(Object);
      response.context.should.equal('user');
      response.message.message.should.equal('hello from client 2');
      done();
    }
    client_2.say({message: "hello from client 2"});
  });

  it('can run actions with errors', function(done){
    client_1.action('cacheTest', function(response){
      response.should.be.an.instanceOf(Object);
      response.error.should.equal("Error: key is a required parameter for this action");
      done();
    });
  });

  it('can run actions properly', function(done){
    client_1.action("cacheTest", {key: "test key", value: "test value"}, function(response){
      response.should.be.an.instanceOf(Object);
      should.not.exist(response.error);
      done();
    });
  });

  it('will limit how many simultanious connections I can have', function(done){
    this.timeout(5000);

    var responses = [];
    client_1.action('sleepTest', {sleepDuration: 500}, function(response){ responses.push(response); })
    client_1.action('sleepTest', {sleepDuration: 600}, function(response){ responses.push(response); })
    client_1.action('sleepTest', {sleepDuration: 700}, function(response){ responses.push(response); })
    client_1.action('sleepTest', {sleepDuration: 800}, function(response){ responses.push(response); })
    client_1.action('sleepTest', {sleepDuration: 900}, function(response){ responses.push(response); })
    client_1.action('sleepTest', {sleepDuration: 1000}, function(response){ responses.push(response); })

    setTimeout(function(){
      responses.length.should.equal(6);
      for(var i in responses){
        var response = responses[i];
        if(i == 0){
          response.error.should.eql("you have too many pending requests");
        }else{
          should.not.exist(response.error)
        }
      }
      done();
    }, 2000);

  });

  // it('can change rooms and get room details', function(done){
  //    client_1.emit("roomChange", {room: "otherRoom"});
  //    setTimeout(function(){
  //     makeSocketRequest(client_1, "roomView", {}, function(response){
  //       response.should.be.an.instanceOf(Object);
  //       should.not.exist(response.error);
  //       response.room.should.equal("otherRoom")
  //       done();
  //      });
  //    }, 500);
  // });

  // it('I can register for messages from rooms I am not in', function(done){
  //   this.timeout(5000);
  //   makeSocketRequest(client_1, "roomChange", {room: 'room1'}, function(response){
  //     makeSocketRequest(client_2, "roomChange", {room: 'room2'}, function(response){
  //       makeSocketRequest(client_1, "listenToRoom", {room: 'room2'}, function(response){
  //         var listener = function(message){
  //           client_1.removeListener('say',listener);
  //           message.message.should.eql("hello in room2")
  //           done();
  //         }
  //         setTimeout(function(){
  //           client_1.on('say', listener);
  //           client_2.emit('say', {message: "hello in room2"});
  //         }, 500);
  //       });
  //     });
  //   });
  // });

  // it('I can unregister for messages from rooms I am not in', function(done){
  //   this.timeout(5000);
  //   makeSocketRequest(client_1, "roomChange", {room: 'room1'}, function(response){
  //     makeSocketRequest(client_2, "roomChange", {room: 'room2'}, function(response){
  //       makeSocketRequest(client_1, "listenToRoom", {room: 'room2'}, function(response){
  //           makeSocketRequest(client_1, "silenceRoom", {room: 'room2'}, function(response){
  //               var listener = function(response){
  //                 client_1.removeListener('data',listener);
  //                 throw new Error("I should not have gotten this message: " + response)
  //                 done();
  //               }
  //               setTimeout(function(){
  //                 client_1.on('say', listener);
  //                 client_2.emit('say', {message: "hello in room2"});
  //               }, 200);
  //               setTimeout(function(){
  //                 client_1.removeListener('say',listener);
  //                 done(); // yay, I didn't get the message
  //               }, 2000);
  //           });
  //       });
  //     });
  //   });
  // });

  // it('can disconnect', function(done){
  //   countWebSocketConnections().should.equal(2);
  //   client_1.disconnect();
  //   client_2.disconnect();
  //   setTimeout(function(){
  //     countWebSocketConnections().should.equal(0);
  //     done();
  //   }, 500);
  // });

});