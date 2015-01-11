var should = require('should');
var actionheroPrototype = require(__dirname + '/../../actionhero.js').actionheroPrototype;
var actionhero = new actionheroPrototype();
var api;

describe('Action: Show Documentation', function(){

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

  it('returns the correct parts', function(done){
    api.specHelper.runAction('showDocumentation', function(response){
        Object.keys(response.documentation).length.should.equal(5); // 5 actions
        response.serverInformation.serverName.should.equal('actionhero API')
        done();
    });
  });

});