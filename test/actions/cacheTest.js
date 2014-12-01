var should = require('should');
var actionheroPrototype = require(__dirname + '/../../actionhero.js').actionheroPrototype;
var actionhero = new actionheroPrototype();
var api;

describe('Action: Cache Test', function(){

  before(function(done){
    actionhero.start(function(err, a){
      api = a;
      done();
    })
  });

  after(function(done){
    actionhero.stop(function(){
      done();
    });
  });

  it('no params', function(done){
    api.specHelper.runAction('cacheTest', {}, function(response){
      response.error.should.be.equal('Error: key is a required parameter for this action');
      done();
    });
  });

  it('just key', function(done){
    api.specHelper.runAction('cacheTest', {key: 'test key'}, function(response){
      response.error.should.be.equal('Error: value is a required parameter for this action');
      done();
    });
  });

  it('just value', function(done){
    api.specHelper.runAction('cacheTest', {value: 'abc123'}, function(response){
      response.error.should.be.equal('Error: key is a required parameter for this action');
      done();
    });
  });

  it('gibberish param', function(done){
    api.specHelper.runAction('cacheTest', {thingy: 'abc123'}, function(response){
      response.error.should.be.equal('Error: key is a required parameter for this action');
      done();
    });
  });

  it('correct params', function(done){
    api.specHelper.runAction('cacheTest', {key: 'testKey', value: 'abc123'}, function(response){
      response.cacheTestResults.saveResp.should.equal(true);
      response.cacheTestResults.loadResp.value.should.equal('abc123');
      response.cacheTestResults.deleteResp.should.equal(true);
      done();
    });
  });
  
  
  it('correct params that are falsey (false booleans, null, "")', function(done){
    api.specHelper.runAction('cacheTest', {key: 'testKey2', value: false }, function(response){
      response.cacheTestResults.saveResp.should.equal(true);
      response.cacheTestResults.loadResp.value.should.equal(false);
      response.cacheTestResults.deleteResp.should.equal(true);
      api.specHelper.runAction('cacheTest', {key: 'testKey3', value: null }, function(response){
        response.cacheTestResults.saveResp.should.equal(true);
        should(response.cacheTestResults.loadResp.value).equal(null);
        response.cacheTestResults.deleteResp.should.equal(true);
        api.specHelper.runAction('cacheTest', {key: 'testKey4', value: '' }, function(response){
          response.cacheTestResults.saveResp.should.equal(true);
          response.cacheTestResults.loadResp.value.should.equal('');
          response.cacheTestResults.deleteResp.should.equal(true);
          api.specHelper.runAction('cacheTest', {key: 'testKey5', value: [] }, function(response){
            response.cacheTestResults.saveResp.should.equal(true);
            response.cacheTestResults.loadResp.value.should.be.Array.and.be.empty;
            response.cacheTestResults.deleteResp.should.equal(true);
            done();
          });
        });
      });
    });
  });

});