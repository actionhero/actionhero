var should = require('should');
var actionHeroPrototype = require(__dirname + "/../../actionHero.js").actionHeroPrototype;
var actionHero = new actionHeroPrototype();
var api;

describe('Action: Status', function(){

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

  it('stats should be returned and make sense', function(done){
    setTimeout(function(){
      api.specHelper.runAction('status', function(response, connection){
        response.uptime.should.be.above(0);
        response.id.length.should.be.above(0);
        response.stats.should.exist
        done();
      });
    }, 1000); // so that we have time to init
  });

});