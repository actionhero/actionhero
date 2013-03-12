describe('Action: chat', function(){
  var specHelper = require('../helpers/specHelper.js').specHelper;
  var apiObj = {};
  var should = require("should");
  var socketURL = "http://localhost:9000";
  var net = require('net')

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
      }, 400);
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
      }, 400);
    });

    it('action should only be valid for http/s clients', function(done){
      this.timeout(5000)

      function makeSocketRequest(thisClient, message, cb){
        var rsp = function(d){ 
          var lines = d.split("\n");
          var lastLine = lines[(lines.length - 1)];
          if(lastLine == ""){ lastLine = lines[(lines.length - 2)]; }
          var parsed = JSON.parse(lastLine);
          thisClient.removeListener('data', rsp); 
          cb(parsed); 
        };
        thisClient.on('data', rsp);
        thisClient.write(message + "\r\n");
      }

      var client = net.connect(specHelper.params[0].tcpServer.port, function(){
        client.setEncoding('utf8');
        
        var d = "";
        var addData = function(data){
          d += data;
        }
        client.on('data', addData);

        setTimeout(function(){
          client.write("chat" + "\r\n");
          setTimeout(function(){
            var lines = d.split("\n");
            var lastLine = lines[(lines.length - 1)];
            if(lastLine == ""){ lastLine = lines[(lines.length - 2)]; }
            var parsed = JSON.parse(lastLine);

            client.removeListener('data', addData); 
            parsed.error.should.equal("Error: this action does not support the socket connection type");
            done();
        }, 500);
        }, 1000);
      });

    });

  });

});
