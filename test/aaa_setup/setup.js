var should = require('should');
var actionHeroPrototype = require(__dirname + "/../../actionHero.js").actionHeroPrototype;
var actionHero = new actionHeroPrototype();
var api;

process.env.NDOE_ENV = 'test'; // force it

describe('Setup', function(){

  before(function(done){
    actionHero.start(function(err, a){
      api = a;
      console.log('')
      console.log('Running suite with fakeredis=' + api.config.redis.fake);
      console.log('')
      done();
    })
  });

  after(function(done){
    actionHero.stop(function(err){
      done();
    });
  });

  it('ensures the TEST env', function(){
    process.env.NDOE_ENV.should.equal('test');
  })

});