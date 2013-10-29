describe('Action: cacheTest', function(){
  var specHelper = require(__dirname + '/_specHelper.js').specHelper;
  var apiObj = {};
  var should = require('should');

  before(function(done){
    this.timeout(5000);
    specHelper.prepare(0, function(api){ 
      apiObj = specHelper.cleanAPIObject(api);
      done();
    })
  });

  it('no params', function(done){
    specHelper.apiTest.get("/cacheTest", 0, {}, function(response, json){
      json.error.should.be.equal("Error: key is a required parameter for this action");
      done();
    });
  });

  it('just key', function(done){
    specHelper.apiTest.get("/cacheTest", 0, {key: "test key"}, function(response, json){
      json.error.should.be.equal("Error: value is a required parameter for this action");
      done();
    });
  });

  it('just value', function(done){
    specHelper.apiTest.get("/cacheTest", 0, {value: 'abc123'}, function(response, json){
      json.error.should.be.equal("Error: key is a required parameter for this action");
      done();
    });
  });

  it('gibberish param', function(done){
    specHelper.apiTest.get("/cacheTest", 0, {thingy: "abc123"}, function(response, json){
      json.error.should.be.equal("Error: key is a required parameter for this action");
      should.not.exist(json.requestorInformation.receivedParams['thingy']);
      done();
    });
  });

  it('correct params', function(done){
    specHelper.apiTest.get("/cacheTest", 0, {key: "testKey", value: "abc123"}, function(response, json){
      json.cacheTestResults.saveResp.should.equal(true);
      json.cacheTestResults.loadResp.value.should.equal('abc123');
      json.cacheTestResults.deleteResp.should.equal(true);
      done();
    });
  });

  it('extra params will be filtered out', function(done){
    specHelper.apiTest.get("/cacheTest", 0, {key: "testKey", value: "abc123", duration: 1}, function(response, json){
      should.equal(json.requestorInformation.receivedParams.key, "testKey");
      should.equal(json.requestorInformation.receivedParams.value, "abc123");
      should.equal(json.requestorInformation.receivedParams.duration, null);
      done();
    });
  });

});