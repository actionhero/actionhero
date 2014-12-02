var should = require('should');
var actionheroPrototype = require(__dirname + '/../../actionhero.js').actionheroPrototype;
var actionhero = new actionheroPrototype();
var api;

describe.only('Action Input Params', function(){

  before(function(done){
    actionhero.start(function(err, a){
      api = a;
      
      api.actions.versions.testAction = [1]
      api.actions.actions.testAction = {
        '1': {
          name: 'testAction',
          description: 'this action has some required params',
          version: 1,
          inputs: { required: [ 'testParam' ], optional: [] },
          outputExample: {},
          run:function(api, connection, next){
            connection.response.param = connection.params.testParam;
            next(connection, true);
          }
        }
      }
      
      done();
    })
  });

  after(function(done){
    actionhero.stop(function(){
    
      delete api.actions.actions.testAction;
      delete api.actions.versions.testAction;
      done();
    });
  });
  
  
  it('correct params that are falsey (false booleans, [])', function(done){
    api.specHelper.runAction('testAction', {testParam: false }, function(response){
      response.param.should.equal(false);
      api.specHelper.runAction('testAction', {testParam: [] }, function(response){
        response.param.should.be.Array.and.be.empty;
        done();
      });
    });
  });
  
  it('correct params respect config options', function(done){
  	api.config.general.missingParamChecks = [ undefined ]
    api.specHelper.runAction('testAction', {testParam: '' }, function(response){
      response.param.should.equal('');
      api.specHelper.runAction('testAction', {testParam: null }, function(response){
      	should(response.param).eql(null);
        done();
      });
    });
  });

});