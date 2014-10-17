var should = require('should');
var actionheroPrototype = require(__dirname + '/../../actionhero.js').actionheroPrototype;
var actionhero = new actionheroPrototype();
var api;

describe('Action: Status', function(){

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

  it('stats should be returned and make sense', function(done){
    setTimeout(function(){
      api.specHelper.runAction('status', function(response){
        response.uptime.should.be.above(0);
        response.id.length.should.be.above(0);
        response.stats.should.exist
        done();
      });
    }, 1000); // so that we have time to init
  });

});