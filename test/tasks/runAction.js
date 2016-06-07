var should = require('should');
var actionheroPrototype = require(__dirname + '/../../actionhero.js').actionheroPrototype;
var actionhero = new actionheroPrototype();
var api;

describe('Test: RunAction', function(){

  before(function(done){
    actionhero.start(function(error, a){
      api = a;
      done();
    });
  });

  after(function(done){
    actionhero.stop(function(){
      done();
    });
  });

  it('can run the task manually', function(done){
    api.specHelper.runTask('runAction', {action: 'randomNumber'}, function(error, response){
      should.not.exist(error);
      response.randomNumber.should.be.greaterThan(0);
      response.randomNumber.should.be.lessThan(1);
      done();
    });
  });

});
