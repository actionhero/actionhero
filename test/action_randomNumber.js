describe('Action: randomNumber', function(){
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

  var firstNumber = null;
  it('random numbers', function(done){
    specHelper.apiTest.get('/randomNumber', 0, {}, function(response, json){
      json.randomNumber.should.be.a('number');
      json.randomNumber.should.be.within(0,1);
      firstNumber = json.randomNumber;
      done();
    });
  });

  it('is unique / random', function(done){
    specHelper.apiTest.get('/randomNumber', 0, {}, function(response, json){
      json.randomNumber.should.be.a('number');
      json.randomNumber.should.not.equal(firstNumber);
      done();
    });
  });

});