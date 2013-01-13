describe('Action: cacheTest', function(){
  var specHelper = require('../helpers/specHelper.js').specHelper;
  var apiObj = {};
  var should = require('should');

  before(function(done){
    specHelper.prepare(0, function(api){ 
      apiObj = specHelper.cleanAPIObject(api);
      done();
    })
  });

  it('cacheTest: no params', function(done){
    specHelper.apiTest.get("/cacheTest", 0, {}, function(response){
      response.body.error.should.be.equal("Error: key is a required parameter for this action");
      done();
    });
  });

  it('cacheTest: just key', function(done){
    specHelper.apiTest.get("/cacheTest", 0, {key: "test key"}, function(response){
      response.body.error.should.be.equal("Error: value is a required parameter for this action");
      done();
    });
  });

  it('cacheTest: just value', function(done){
    specHelper.apiTest.get("/cacheTest", 0, {value: 'abc123'}, function(response){
      response.body.error.should.be.equal("Error: key is a required parameter for this action");
      done();
    });
  });

  it('cacheTest: gibberish param', function(done){
    specHelper.apiTest.get("/cacheTest", 0, {thingy: "abc123"}, function(response){
      response.body.error.should.be.equal("Error: key is a required parameter for this action");
      should.not.exist(response.body.requestorInformation.receivedParams['thingy']);
      done();
    });
  });

  it('cacheTest: correct params', function(done){
    specHelper.apiTest.get("/cacheTest", 0, {key: "testKey", value: "abc123"}, function(response){
      response.body.cacheTestResults.saveResp.should.equal(true);
      response.body.cacheTestResults.loadResp.value.should.equal('abc123');
      response.body.cacheTestResults.deleteResp.should.equal(true);
      done();
    });
  });

});