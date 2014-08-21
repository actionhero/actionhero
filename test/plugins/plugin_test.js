var should = require('should');
var actionheroPrototype = require(__dirname + "/../../actionhero.js").actionheroPrototype;
var actionhero = new actionheroPrototype();
var api;

describe('Plugin', function(){

  before(function(done){
    process.env.ACTIONHERO_CONFIG = __dirname + '/config';
    actionhero.start(function(err, a){
      api = a;
      
      //test variable for plugin tasks
      api.config.test.task = null;
      
      done();
    })
    //delete the ACTIONHERO_CONFIG env to prevent some errors on other tests
    delete process.env.ACTIONHERO_CONFIG;
  });

  after(function(done){
    //delete the ACTIONHERO_CONFIG env to prevent some errors on other tests
    delete process.env.ACTIONHERO_CONFIG;
    
    actionhero.stop(function(err){
      done();
    });
  });

  it('plugin action should be loaded', function(done){
    api.specHelper.runAction('test_action', function(response, connection){
      response.test.should.be.equal('OK');
      done();
    });
  });
  
  it('plugin config should be loaded', function(){
    api.config.test.config.should.be.equal('OK');
  });
  
  it('plugin should not overwrite application config', function(){
    api.config.general.test_config.should.be.equal('Application');
  });
  
  it('plugin should be able to overwrite actionhero default config', function(){
    api.config.general.serverName.should.be.equal('actionhero API (Plugin)');
  });
  
  it('plugin should be able to add other paths (actions2)', function(done){
    api.specHelper.runAction('test_action2', function(response, connection){
      response.test.should.be.equal('OK');
      done();
    });
  });
  
  it('plugin initializer should be loaded', function(){
    api.test_initializer.should.be.equal('OK');
  });
  
  
  it('plugin task should be loaded', function(done){
    should.not.exist(api.config.test.task);
    api.specHelper.runTask('test_task', {}, function(){
      api.config.test.task.should.be.equal('OK');
      done()
    })
  });

});