var should = require('should');
var actionHeroPrototype = require(__dirname + "/../../actionHero.js").actionHeroPrototype;
var actionHero = new actionHeroPrototype();
var api;

describe('Action: Cache Test', function(){

  before(function(done){
    actionHero.start(function(err, a){
      api = a;
      done();
    })
  });

  after(function(done){
    actionHero.stop(function(err){
      done();
    });
  });

  it('no params', function(done){
    api.specHelper.runAction('cacheTest', {}, function(response, connection){
      response.error.should.be.equal('Error: key is a required parameter for this action');
      done();
    });
  });

  it('just key', function(done){
    api.specHelper.runAction('cacheTest', {key: 'test key'}, function(response, connection){
      response.error.should.be.equal('Error: value is a required parameter for this action');
      done();
    });
  });

  it('just value', function(done){
    api.specHelper.runAction('cacheTest', {value: 'abc123'}, function(response, connection){
      response.error.should.be.equal('Error: key is a required parameter for this action');
      done();
    });
  });

  it('gibberish param', function(done){
    api.specHelper.runAction('cacheTest', {thingy: 'abc123'}, function(response, connection){
      response.error.should.be.equal('Error: key is a required parameter for this action');
      done();
    });
  });

  it('correct params', function(done){
    api.specHelper.runAction('cacheTest', {key: 'testKey', value: 'abc123'}, function(response, connection){
      response.cacheTestResults.saveResp.should.equal(true);
      response.cacheTestResults.loadResp.value.should.equal('abc123');
      response.cacheTestResults.deleteResp.should.equal(true);
      done();
    });
  });

});