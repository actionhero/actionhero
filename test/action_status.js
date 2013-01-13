describe('Action: status', function(){
  var specHelper = require('../helpers/specHelper.js').specHelper;
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
      specHelper.apiTest.get('/status', 0, {}, function(response){
        response.statusCode.should.equal(200);

        response.body.uptime.should.be.above(0);
        response.body.id.length.should.be.above(0);

        response.body.stats.local['actions:actionsCurrentlyProcessing'].should.be.above(0);
        response.body.stats.local['actions:totalProcessedActions'].should.be.above(0);
        
        done();
      });
    });
  });

});