process.env.NODE_ENV = 'test';

var should = require('should');
var actionheroPrototype = require('actionhero').actionheroPrototype;
var actionhero = new actionheroPrototype();
var api;

describe('actionhero Tests', function(){

  before(function(done){
    actionhero.start(function(err, a){
      api = a;
      done();
    })
  });

  after(function(done){
    actionhero.stop(function(err){
      done();
    });
  })

  it('should have booted into the test env', function(){
    process.env.NODE_ENV.should.equal('test');
    api.env.should.equal('test');
    should.exist(api.id);
  });

  it('can retrieve server uptime via the status action', function(){
    api.specHelper.runAction('status', function(response){
      should.not.exist(response.error);
      response.uptime.should.be.above(0);
      done();
    });
  });

});
