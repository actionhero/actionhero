describe('Action: chat', function(){
  var specHelper = require('../helpers/_specHelper.js').specHelper;
  var apiObj = {};
  var should = require("should");

  before(function(done){
    specHelper.prepare(0, function(api){ 
      apiObj = specHelper.cleanAPIObject(api);
      done();
    })
  });

  clientID = null;

  it('I can my chat details', function(done){
    specHelper.apiTest.get('/chat/?method=detailsView', 0, {}, function(response){
      response.body.error.should.equal("OK");
      clientID = response.body.details.public.id
      done();
    });
  });

  it('I can my room details', function(done){
    specHelper.apiTest.get('/chat/?method=roomView', 0, {}, function(response){
      response.body.error.should.equal("OK");
      response.body.roomStatus.room.should.equal('defaultRoom')
      done();
    });
  });

  it('clientID sticks (cookies)', function(done){
    specHelper.apiTest.get('/chat/?method=detailsView', 0, {}, function(response){
      response.body.error.should.equal("OK");
      clientID.should.equal(response.body.details.public.id);
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
    apiObj.chatRoom.socketRoomBroadcast(apiObj, {room: 'defaultRoom'}, "TEST");
    setTimeout(function(){
      specHelper.apiTest.get('/chat/?method=messages', 0, {}, function(response){
        response.body.message.message.should.equal("TEST");
        done();
      }); 
    }, 10);
  });

});
