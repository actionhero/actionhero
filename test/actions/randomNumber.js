var should = require('should');
var actionHeroPrototype = require(__dirname + "/../../actionHero.js").actionHeroPrototype;
var actionHero = new actionHeroPrototype();
var api;

describe('Action: Random Number', function(){

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

  var firstNumber = null;
  it('random numbers', function(done){
    api.specHelper.runAction('randomNumber', function(response, connection){
      response.randomNumber.should.exit
      response.randomNumber.should.be.a.Number;
      response.randomNumber.should.be.within(0,1);
      firstNumber = response.randomNumber;
      done();
    });
  });

  it('is unique / random', function(done){
    api.specHelper.runAction('randomNumber', function(response, connection){
      response.randomNumber.should.be.a.Number;
      response.randomNumber.should.not.equal(firstNumber);
      done();
    });
  });

});