describe('Action: randomNumber', function(){
  var specHelper = require('../helpers/specHelper.js').specHelper;
  var apiObj = {};
  var should = require("should");

  before(function(done){
    specHelper.prepare(0, function(api){ 
      apiObj = specHelper.cleanAPIObject(api);
      done();
    })
  });

  var firstNumber = null;
  it('random numbers', function(done){
    specHelper.apiTest.get('/randomNumber', 0, {}, function(response){
      response.body.randomNumber.should.be.a('number');
      response.body.randomNumber.should.be.within(0,1);
      firstNumber = response.body.randomNumber;
      done();
    });
  });

  it('is unique / random', function(done){
    specHelper.apiTest.get('/randomNumber', 0, {}, function(response){
      response.body.randomNumber.should.be.a('number');
      response.body.randomNumber.should.not.equal(firstNumber);
      done();
    });
  });

});