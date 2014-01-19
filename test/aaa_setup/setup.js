var should = require('should');
var actionheroPrototype = require(__dirname + "/../../actionhero.js").actionheroPrototype;
var actionhero = new actionheroPrototype();
var api;

process.env.NDOE_ENV = 'test'; // force it

describe('Setup', function(){

  before(function(done){
    actionhero.start(function(err, a){
      api = a;
      console.log('')
      console.log('Running suite with fakeredis=' + api.config.redis.fake);
      console.log('')
      done();
    })
  });

  after(function(done){
    actionhero.stop(function(err){
      done();
    });
  });

  it('should have booted into the test env', function(){
    process.env.NDOE_ENV.should.equal('test');
    api.env.should.equal('test');
    should.exist(api.id);
  });

});