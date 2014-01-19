var should = require('should');
var actionheroPrototype = require(__dirname + "/../../actionhero.js").actionheroPrototype;
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
    actionhero.stop(function(err){
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
        inputs: { required: [], optional: [] },
        outputExample: {},
        version: 1,
        run: function(api, connection, next){
          thing // undefined
          next(connection, true);
        }
      }
    }
    api.actions.versions['badAction'] = [1];
    api.actions.actions['badAction'].should.be.an.instanceOf(Object);
    done();
  });

  it('the bad action should fail gracefully', function(done){
    /**
     * @nullivex
     * This test in particular is interesting because of the way it expects
     * mocha to handle and rethrow the exception.
     *
     * Implementing grunt and grunt-mocha-test will run this code inside a domain
     * and the action runner also creates a domain so they are nested. In node ~0.8.9
     * this seems to cause the exception to land in mocha's lap rather than being
     * rethrown to the child domain.
     *
     * I believe this works fine in node ~0.9.0 because they ironed out some of the
     * issues especially with nested domains and how exceptions are bubbled in those
     * environments there is an issue about this here: https://github.com/joyent/node/issues/4375
     *
     * So, it is best just to ignore this test in node ~0.8.9 and below and it should
     * still pass in normal environments.
     */
    if(9 < parseInt(process.version.split('.')[1],10)){
      api.specHelper.runAction('badAction', {}, function(response, connection){
        response.error.should.equal('Error: The server experienced an internal error');
        done();
      });
    } else {
      done()
    }
  });

  it('other actions still work', function(done){
    api.specHelper.runAction('randomNumber', {}, function(response, connection){
      should.not.exist(response.error);
      done();
    });
  });

  it('I can remove the bad action', function(done){
    delete api.actions.actions['badAction'];
    delete api.actions.versions['badAction'];
    should.not.exist(api.actions.actions['badAction']);
    done();
  });
});
