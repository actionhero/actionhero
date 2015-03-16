var should = require('should');
var actionheroPrototype = require(__dirname + '/../../actionhero.js').actionheroPrototype;
var actionhero = new actionheroPrototype();
var api;

describe('Core: Exceptions', function(){

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

  var uncaughtExceptionHandlers = process.listeners('uncaughtException');
  beforeEach(function(done){
    uncaughtExceptionHandlers.forEach(function(e){
      process.removeListener('uncaughtException', e);
    });
    done();
  })

  afterEach(function(done){
    uncaughtExceptionHandlers.forEach(function(e){
      process.on('uncaughtException', e);
    });
    done();
  });

  it('I can inject a bad task that breaks', function(done){
    api.actions.actions.badAction = {
      '1': {
        name: 'badAction',
        description: 'I will break',
        outputExample: {},
        version: 1,
        run: function(api, connection, next){
          thing // undefined
          next();
        }
      }
    }
    api.actions.versions.badAction = [1];
    api.actions.actions.badAction.should.be.an.instanceOf(Object);
    done();
  });

  it('the bad action should fail gracefully', function(done){
    if(api.config.general.actionDomains === true){
      api.specHelper.runAction('badAction', {}, function(response){
        response.error.should.equal('Error: The server experienced an internal error');
        done();
      });
    }else{
      done();
    }
  });

  it('other actions still work', function(done){
    api.specHelper.runAction('randomNumber', {}, function(response){
      should.not.exist(response.error);
      done();
    });
  });

  it('I can remove the bad action', function(done){
    delete api.actions.actions.badAction;
    delete api.actions.versions.badAction;
    should.not.exist(api.actions.actions.badAction);
    done();
  });
});
