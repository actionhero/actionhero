describe('Client: Web Sockets', function(){
  var specHelper = require('../helpers/specHelper.js').specHelper;
  var apiObj = {};
  var should = require("should");
  var io = require('socket.io-client');
  var socketURL = "http://localhost:9000";
  var io_options ={
    transports: ['websocket'],
    'force new connection': true
  };
  
  var client_1 = {};
  var client_2 = {};
  var client_3 = {};

  function makeSocketRequest(thisClient, type, data, cb){
    var listener = function(response){ 
      thisClient.removeListener('response', listener); 
      cb(response); 
    };
    thisClient.on('response', listener);
    thisClient.emit(type, data);
  }

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
        apiObj = specHelper.cleanAPIObject(api);
        done();
      })
    });

    it('socket client connections should work: client 1', function(done){
      client_1 = io.connect(socketURL, io_options);
      client_1.on('welcome', function(data){
        data.should.be.an.instanceOf(Object);
        data.context.should.equal("api");
        data.room.should.equal("defaultRoom");
              setTimeout(function(){
            done();
          }, 1000);
      });
    });

    it('socket client connections should work: client 2', function(done){
      client_2 = io.connect(socketURL, io_options);
      client_2.on('welcome', function(data){
        data.should.be.an.instanceOf(Object);
        data.context.should.equal("api");
        data.room.should.equal("defaultRoom");
        setTimeout(function(){
            done();
        }, 1000);
      });
    });

    it('Other clients should have been told about people entering the room', function(done){
      this.timeout(3000)
      var listener = function(response){
        client_1.removeListener('say', listener);
        response.should.be.an.instanceOf(Object);
        response.context.should.equal('user');
        response.message.should.equal('I have entered the room');
        setTimeout(function(){
            client_3.disconnect();
            setTimeout(function(){
                done();
            }, 1000);  
        }, 1000);
      }
      client_1.on('say', listener);
      client_3 = io.connect(socketURL, io_options);
    });

    it('I can get my connection details', function(done){
      makeSocketRequest(client_1, "detailsView", {}, function(response){
        response.should.be.an.instanceOf(Object);
        response.status.should.equal("OK")
        response.details.connectedAt.should.be.within(0, new Date().getTime())
        response.details.room.should.equal("defaultRoom")
        done()
      });
    });

    it('Clients can talk to each other', function(done){
      var listener = function(response){
        client_1.removeListener('say', listener);
        response.should.be.an.instanceOf(Object);
        response.context.should.equal('user');
        response.message.should.equal('hello from client 2');
        done();
      }
      client_1.on('say', listener);
      client_2.emit("say", {message: "hello from client 2"});
    });

    it('can run actions with errors', function(done){
      makeSocketRequest(client_1, "action", {action: "cacheTest"}, function(response){
        response.should.be.an.instanceOf(Object);
        response.error.should.equal("Error: key is a required parameter for this action");
        done();
      });
    });

    it('can run actions', function(done){
      makeSocketRequest(client_1, "action", {action: "cacheTest", key: "test key", value: "test value"}, function(response){
        response.should.be.an.instanceOf(Object);
            should.not.exist(response.error);
        done();
      });
    });

    it('will limit how many simultanious connections I can have', function(done){
      this.timeout(5000)
      client_1.emit('action', {action: 'sleepTest', params: {sleepDuration: 500}});
      client_1.emit('action', {action: 'sleepTest', params: {sleepDuration: 600}});
      client_1.emit('action', {action: 'sleepTest', params: {sleepDuration: 700}});
      client_1.emit('action', {action: 'sleepTest', params: {sleepDuration: 800}});
      client_1.emit('action', {action: 'sleepTest', params: {sleepDuration: 900}});
      client_1.emit('action', {action: 'sleepTest', params: {sleepDuration: 1000}});

      var responses = []
      var checkResponses = function(data){
        responses.push(data);
        if(responses.length == 6){
          for(var i in responses){
            var response = responses[i];
            if(i == 0){
              response.error.should.eql("you have too many pending requests");
            }else{
              should.not.exist(response.error)
            }
          }

          client_1.removeListener('response', checkResponses);
          done();
        }
      }

      client_1.on('response', checkResponses);
    });

    it('can change rooms and get room details', function(done){
       client_1.emit("roomChange", {room: "otherRoom"});
       makeSocketRequest(client_1, "roomView", {}, function(response){
        response.should.be.an.instanceOf(Object);
        should.not.exist(response.error);
        response.room.should.equal("otherRoom")
        done();
       });
    });

    it('I can register for messages from rooms I am not in', function(done){
      this.timeout(5000);
      makeSocketRequest(client_1, "roomChange", {room: 'room1'}, function(response){
        makeSocketRequest(client_2, "roomChange", {room: 'room2'}, function(response){
          makeSocketRequest(client_1, "listenToRoom", {room: 'room2'}, function(response){
            var listener = function(message){
              client_1.removeListener('say',listener);
              message.message.should.eql("hello in room2")
              done();
            }
            setTimeout(function(){
              client_1.on('say', listener);
              client_2.emit('say', {message: "hello in room2"});
            }, 100);
          });
        });
      });
    });

    it('I can unregister for messages from rooms I am not in', function(done){
      this.timeout(5000);
      makeSocketRequest(client_1, "roomChange", {room: 'room1'}, function(response){
        makeSocketRequest(client_2, "roomChange", {room: 'room2'}, function(response){
          makeSocketRequest(client_1, "listenToRoom", {room: 'room2'}, function(response){
              makeSocketRequest(client_1, "silenceRoom", {room: 'room2'}, function(response){
                  var listener = function(response){
                    client_1.removeListener('data',listener);
                    throw new Error("I should not have gotten this message: " + response)
                    done();
                  }
                  setTimeout(function(){
                    client_1.on('say', listener);
                    client_2.emit('say', {message: "hello in room2"});
                  }, 100);
                  setTimeout(function(){
                    client_1.removeListener('say',listener);
                    done(); // yay, I didn't get the message
                  }, 2000);
              });
          });
        });
      });
    });

    it('can disconnect', function(done){
      countWebSocketConnections().should.equal(2);
      client_1.disconnect();
      client_2.disconnect();
      setTimeout(function(){
        countWebSocketConnections().should.equal(0);
        done();
      }, 500);
    })
});