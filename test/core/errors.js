var should = require('should');
var actionheroPrototype = require(__dirname + '/../../actionhero.js').actionheroPrototype;
var actionhero = new actionheroPrototype();
var api;

describe('Core: Errors', function(){
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

  it('returns string errors properly', function(done){
    api.specHelper.runAction('notARealAction', {}, function(response){
      response.error.should.equal('Error: unknown action or invalid apiVersion');
      done();
    });
  });
  
  it('returns Error object properly', function(done){
    api.config.errors.unknownAction = function(){
      return new Error('error test');
    };
    api.specHelper.runAction('notARealAction', {}, function(response){
      response.error.should.equal('Error: error test');
      done();
    });
  });
  
  it('returns generic object properly', function(done){
    api.config.errors.unknownAction = function(){
      return {code:'error111'};
    };
    api.specHelper.runAction('notARealAction', {}, function(response){
      response.error.should.have.property('code').equal('error111');
      done();
    });
  });

  it('accepts an int to add to the random number', function(done){
    api.specHelper.runAction('randomNumber', { toAdd : 1 }, function(response, connection){
      response.randomNumber.should.be.a.Number;
      response.randomNumber.should.be.within(1,2);
      done();
    });
  });

  it('rejects a float param', function(done){
    api.specHelper.runAction('randomNumber', { toAdd : 1.5 }, function(response, connection){
      should.exist(response.error);
      done();
    });
  });

});