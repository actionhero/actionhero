describe('Action: status', function(){
  var specHelper = require('../helpers/specHelper.js').specHelper;
  var apiObj = {};
  var should = require("should");

  before(function(done){
    this.timeout(5000);
    specHelper.prepare(0, function(api){ 
      apiObj = specHelper.cleanAPIObject(api);
      done();
    })
  });

  it('stats should be returned and make sense', function(done){
    specHelper.apiTest.get('/status', 0, {}, function(response, json){
      specHelper.apiTest.get('/status', 0, {}, function(response, json){
        response.statusCode.should.equal(200);

        json.uptime.should.be.above(0);
        json.id.length.should.be.above(0);

        json.stats.local.actions.actionsCurrentlyProcessing.should.be.above(0);
        json.stats.local.actions.totalProcessedActions.should.be.above(0);
        
        done();
      });
    });
  });

});