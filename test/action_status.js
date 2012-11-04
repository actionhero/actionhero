describe('Action: status', function(){
  var specHelper = require('../helpers/_specHelper.js').specHelper;
  var apiObj = {};
  var should = require("should");

  before(function(done){
    specHelper.prepare(0, function(api){ 
      apiObj = specHelper.cleanAPIObject(api);
      done();
    })
  });

  it('stats should be returned and make sense', function(done){
    specHelper.apiTest.get('/status', 0, {}, function(response){
      response.statusCode.should.equal(200);
      response.body.stats.webServer.numberOfGlobalWebRequests.should.be.above(0);
      response.body.stats.socketServer.numberOfGlobalSocketRequests.should.be.above(-1);
      response.body.stats.uptimeSeconds.should.be.above(0);
      response.body.stats.id.length.should.be.above(0);
      done();
    });
  });

});