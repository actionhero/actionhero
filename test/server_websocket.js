describe('Server: Web Sockets', function(){

  var specHelper = require(__dirname + '/_specHelper.js').specHelper;
  var apiObj = {};
  var should = require('should');
  var socketURL = 'http://localhost:9000';
  var faye = require('faye');
  var actionHeroWebSocket = require(process.cwd() + '/public/javascript/actionHeroWebSocket.js').actionHeroWebSocket;
  var client_1 = new actionHeroWebSocket({host: socketURL, faye: faye, connectionDelay: 500});
  var client_2 = new actionHeroWebSocket({host: socketURL, faye: faye, connectionDelay: 500});
  var client_3 = new actionHeroWebSocket({host: socketURL, faye: faye, connectionDelay: 500});

  function countWebSocketConnections(){
    var found = 0;
    for(var i in apiObj.connections.connections){
      if('websocket' === apiObj.connections.connections[i].type){
        found++;
      }
    }
    return found;
  }

  before(function(done){
    this.timeout(5000);
    specHelper.prepare(0, function(api){
      apiObj = api;
      done();
    })
  });

  it('faye should work in general', function(done){
    var client = new faye.Client(socketURL + '/faye');
    client.subscribe('/test', function(message){
      message.message.should.equal('hello');
      done();
    });

    setTimeout(function(){
      apiObj.faye.client.publish('/test', {message: 'hello'});
    }, 500);
  });

  it('socket client connections should work: client 1', function(done){
    client_1.connect(function(err, data){
      data.should.be.an.instanceOf(Object);
      data.context.should.equal('response');
      data.data.totalActions.should.equal(0);
      client_1.welcomeMessage.should.equal('Hello! Welcome to the actionHero api');
      done();
    });
  });

  it('socket client connections should work: client 2', function(done){
    client_2.connect(function(err, data){
      data.should.be.an.instanceOf(Object);
      data.context.should.equal('response');
      data.data.totalActions.should.equal(0);
      client_2.welcomeMessage.should.equal('Hello! Welcome to the actionHero api');
      done();
    });
  });

  it('socket client connections should work: client 3', function(done){
    client_3.connect(function(err, data){
      data.should.be.an.instanceOf(Object);
      data.context.should.equal('response');
      data.data.totalActions.should.equal(0);
      client_3.welcomeMessage.should.equal('Hello! Welcome to the actionHero api');
      done();
    });
  });

  it('I can get my connection details', function(done){
    client_1.detailsView(function(response){
      response.should.be.an.instanceOf(Object);
      response.data.connectedAt.should.be.within(0, new Date().getTime())
      response.data.remoteIP.should.equal('127.0.0.1');
      done()
    });
  });

  it('can run actions with errors', function(done){
    client_1.action('cacheTest', function(response){
      response.should.be.an.instanceOf(Object);
      response.error.should.equal('Error: key is a required parameter for this action');
      done();
    });
  });

  it('can run actions properly', function(done){
    client_1.action('cacheTest', {key: 'test key', value: 'test value'}, function(response){
      response.should.be.an.instanceOf(Object);
      should.not.exist(response.error);
      done();
    });
  });

  it('will limit how many simultaneous connections I can have', function(done){
    this.timeout(5000);

    var responses = [];
    client_1.action('sleepTest', {sleepDuration: 500}, function(response){ responses.push(response) })
    client_1.action('sleepTest', {sleepDuration: 600}, function(response){ responses.push(response) })
    client_1.action('sleepTest', {sleepDuration: 700}, function(response){ responses.push(response) })
    client_1.action('sleepTest', {sleepDuration: 800}, function(response){ responses.push(response) })
    client_1.action('sleepTest', {sleepDuration: 900}, function(response){ responses.push(response) })
    client_1.action('sleepTest', {sleepDuration: 1000}, function(response){ responses.push(response) })

    setTimeout(function(){
      responses.length.should.equal(6);
      for(var i in responses){
        var response = responses[i];
        if(0 === i){
          response.error.should.eql('you have too many pending requests');
        } else {
          should.not.exist(response.error)
        }
      }
      done();
    }, 2000);
  });

  describe('chat', function(){

    beforeEach(function(done){
      client_1.roomChange('defaultRoom',function(response){
        client_2.roomChange('defaultRoom',function(response){
          client_3.roomChange('defaultRoom',function(response){
            done();
          });
        });
      });
    });

    it('can change rooms and get room details', function(done){
      client_1.roomChange('otherRoom', function(){
        client_1.detailsView(function(response){
          response.should.be.an.instanceOf(Object);
          should.not.exist(response.error);
          response.data.room.should.equal('otherRoom')
          done();
        });
      });
    });

    it('Clients can talk to each other', function(done){
      client_1.events.say = function(response){
        delete client_1.events.say;
        response.should.be.an.instanceOf(Object);
        response.context.should.equal('user');
        response.message.should.equal('hello from client 2');
        done();
      }
      client_2.say('hello from client 2'); // TODO: why does this block without a callback?
    });

    it('I can register for messages from rooms I am not in; and then unregister', function(done){
      this.timeout(5000)
      client_1.roomChange('defaultRoom', function(){
        client_2.roomChange('otherRoom', function(){
          
          setTimeout(function(){
            client_1.listenToRoom('otherRoom', function(){
              client_1.events.say = function(response){
                delete client_1.events.say;
                response.should.be.an.instanceOf(Object);
                response.context.should.equal('user');
                response.message.should.equal('hello in otherRoom');
                
                client_1.silenceRoom('otherRoom');
                
                client_1.events.say = function(response){
                  delete client_1.events.say;
                  throw new Error('I should not have gotten this message: ' + response);
                }
                setTimeout(function(){
                  delete client_1.events.say;
                  done(); // yay!
                }, 1000)
                setTimeout(function(){
                  client_2.say('hello in otherRoom');
                }, 500);

              }
              client_2.say('hello in otherRoom');
            });
          }, 500);

        });
      });
    });

  });

  describe('disconnect', function(){

    it('can disconnect', function(done){
      countWebSocketConnections().should.equal(3);
      client_1.disconnect();
      client_2.disconnect();
      client_3.disconnect();
      setTimeout(function(){
        countWebSocketConnections().should.equal(0);
        done();
      }, 500);
    });

  })

});