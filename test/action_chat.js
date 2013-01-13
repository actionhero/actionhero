describe('Action: chat', function(){
  var specHelper = require('../helpers/specHelper.js').specHelper;
  var apiObj = {};
  var should = require("should");
  var io = require('socket.io-client');
  var socketURL = "http://localhost:9000";
  var io_options ={
    transports: ['websocket'],
    'force new connection': true
  };

  before(function(done){
    specHelper.prepare(0, function(api){ 
      apiObj = specHelper.cleanAPIObject(api);
      apiObj.configData.commonWeb.httpClientMessageTTL = null;
      done();
    })
  });

  after(function(done){
    apiObj.configData.commonWeb.httpClientMessageTTL = null;
    done();
  });

  describe('should be off', function(){
    it('messages should not be saved when httpClientMessageTTL is null', function(done){
      apiObj.chatRoom.socketRoomBroadcast(apiObj, {room: 'defaultRoom'}, "TEST");
      setTimeout(function(){
        specHelper.apiTest.get('/chat/?method=messages', 0, {}, function(response){
          should.equal(null, response.body.message);
          done();
        }); 
      }, 50);
    });
  });

  describe('should be on', function(){

    var clientID = null;

    before(function(done){
      apiObj.configData.commonWeb.httpClientMessageTTL = 10000;
      specHelper.apiTest.get('/chat/?method=detailsView', 0, {}, function(response){
        clientID = response.body.details.id
        done();
      });
    });

    it('I can my room details', function(done){
      specHelper.apiTest.get('/chat/?method=roomView', 0, {}, function(response){
        response.body.roomStatus.room.should.equal('defaultRoom')
        done();
      });
    });

    it('clientID sticks (cookies)', function(done){
      specHelper.apiTest.get('/chat/?method=detailsView', 0, {}, function(response){
        clientID.should.equal(response.body.details.id);
        done();
      });
    });

    it('I can change rooms', function(done){
      specHelper.apiTest.get('/chat/?method=roomChange&room=anotherRoom', 0, {}, function(){
        specHelper.apiTest.get('/chat/?method=roomView', 0, {}, function(response){
          response.body.roomStatus.room.should.equal('anotherRoom');
          done();
        }); 
      });
    });

    it('I can change back', function(done){
      specHelper.apiTest.get('/chat/?method=roomChange&room=defaultRoom', 0, {}, function(){
        specHelper.apiTest.get('/chat/?method=roomView', 0, {}, function(response){
          response.body.roomStatus.room.should.equal('defaultRoom');
          done();
        }); 
      });
    });

    it('I should get messages from other clients', function(done){
      apiObj.chatRoom.socketRoomBroadcast({room: 'defaultRoom'}, "TEST");
      setTimeout(function(){
        specHelper.apiTest.get('/chat/?method=messages', 0, {}, function(response){
          response.body.messages[0].message.should.equal("TEST");
          done();
        }); 
      }, 50);
    });

    it('I can get many messagse and the order is maintained', function(done){
      apiObj.chatRoom.socketRoomBroadcast({room: 'defaultRoom'}, "TEST: A");
      apiObj.chatRoom.socketRoomBroadcast({room: 'defaultRoom'}, "TEST: B");
      apiObj.chatRoom.socketRoomBroadcast({room: 'defaultRoom'}, "TEST: C");
      setTimeout(function(){
        specHelper.apiTest.get('/chat/?method=messages', 0, {}, function(response){
          response.body.messages[0].message.should.equal("TEST: A");
          response.body.messages[1].message.should.equal("TEST: B");
          response.body.messages[2].message.should.equal("TEST: C");
          done();
        }); 
      }, 50);
    });

    it('action should only be valid for http/s clients', function(done){
      var client = io.connect(socketURL, io_options);
      client.on('welcome', function(data){
        client.on('response', function(data){
          client.removeListener('response', this); 
          data.error.should.equal("Error: this action does not support the webSocketconnection type");
          client.disconnect();
          done();
        });
        client.emit('action', {action: 'chat'});
      });
    });

  });

});
