var should = require('should');
var actionheroPrototype = require(__dirname + '/../../actionhero.js').actionheroPrototype;
var actionhero = new actionheroPrototype();
var api;

describe('Action: status', function(){

  before(function(done){
    actionhero.start(function(error, a){
      api = a;
      done();
    });
  });

  before((done) => {
    // time for serer to settle for health check
    setTimeout(done, 4000);
  });

  after(function(done){
    actionhero.stop(function(){
      done();
    });
  });

  var firstNumber = null;
  it('returns node status', function(done){
    api.specHelper.runAction('status', function(response){
      response.problems.length.should.equal(0);
      response.id.should.equal('test-server');
      done();
    });
  });


});
