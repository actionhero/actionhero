var should = require('should');
var actionheroPrototype = require(__dirname + "/../../actionhero.js").actionheroPrototype;
var actionhero = new actionheroPrototype();
var api;

describe('Core: Middleware', function(){

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

  afterEach(function(done){
    api.actions.preProcessors  = [];
    api.actions.postProcessors = [];
    done();
  });
  
  describe('action preProcessors', function(){

    it('I can define an action preProcessor and it can append the connection', function(done){
      api.actions.preProcessors.push(function(connection, actionTemplate, next){
        connection.response._preProcessorNote = 'note'
        next(connection, true);
      });

      api.specHelper.runAction('randomNumber', function(response, connection){
        response._preProcessorNote.should.equal('note');
        done();
      });
    });

    it('postProcessors can append the connection', function(done){
      api.actions.postProcessors.push(function(connection, actionTemplate, toRender, next){
        connection.response._postProcessorNote = 'note'
        next(connection, true);
      });

      api.specHelper.runAction('randomNumber', function(response, connection){
        response._postProcessorNote.should.equal('note');
        done();
      });
    })

    it('preProcessors can block actions', function(done){
      api.actions.preProcessors.push(function(connection, actionTemplate, next){
        connection.error = 'BLOCKED'
        next(connection, false);
      });

      api.specHelper.runAction('randomNumber', function(response, connection){
        connection.error.should.equal('BLOCKED');
        should.not.exist(connection.randomNumber);
        done();
      });
    })

    it('postProcessors can modify toRender', function(done){
      api.actions.postProcessors.push(function(connection, actionTemplate, toRender, next){
        next(connection, false);
      });

      api.specHelper.runAction('randomNumber', function(response, connection){
        throw new Error('should not get a response');
      });
      setTimeout(function(){
        done();
      }, 500);
    })
  
  })

  describe('connection create/destroy callbacks', function(){

    beforeEach(function(done){
      api.connections.createCallbacks = [];
      api.connections.destroyCallbacks = [];
      done();
    })

    afterEach(function(done){
      api.connections.createCallbacks = [];
      api.connections.destroyCallbacks = [];
      done();
    })

    it('can create callbacks on connection creation', function(done){
      api.connections.createCallbacks.push(function(c){
        done();
      });
      api.specHelper.runAction('randomNumber', function(response, connection){
        //
      });
    });

    it('can create callbacks on connection destroy', function(done){
      api.connections.destroyCallbacks.push(function(c){
        done();
      });
      api.specHelper.runAction('randomNumber', function(response, connection){
        connection.destroy();
      });
    })

  })

});
