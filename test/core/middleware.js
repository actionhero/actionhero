var should = require('should');
var actionheroPrototype = require(__dirname + '/../../actionhero.js').actionheroPrototype;
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
    actionhero.stop(function(){
      done();
    });
  });

  afterEach(function(done){
    api.actions.preProcessors  = {};
    api.actions.postProcessors = {};
    api.actions.middleware = {};
    done();
  });
  
  describe('action preProcessors', function(){

    it('I can define an action preProcessor and it can append the connection', function(done){
      api.actions.addPreProcessor(function(connection, actionTemplate, next){
        connection.response._preProcessorNote = 'note'
        next(connection, true);
      });

      api.specHelper.runAction('randomNumber', function(response){
        response._preProcessorNote.should.equal('note');
        done();
      });
    });
    
    it('preProcessors with priorities run in the right order', function(done){
      // first priority
      api.actions.addPreProcessor(function(connection, actionTemplate, next){
        connection.response._processorNoteFirst = 'first';
        connection.response._processorNoteEarly = 'first';
        connection.response._processorNoteLate = 'first';
        connection.response._processorNoteDefault = 'first';
        next(connection, true);
      }, 1);
      
      // lower number priority (runs sooner)
      api.actions.addPreProcessor(function(connection, actionTemplate, next){
        connection.response._processorNoteEarly = 'early';
        connection.response._processorNoteLate = 'early';
        connection.response._processorNoteDefault = 'early';
        next(connection, true);
      }, api.config.general.defaultProcessorPriority-1);
      
      // old style "default" priority
      api.actions.addPreProcessor(function(connection, actionTemplate, next){
        connection.response._processorNoteLate = 'default';
        connection.response._processorNoteDefault = 'default';
        next(connection, true);
      });
      
      // higher number priority (runs later)
      api.actions.addPreProcessor(function(connection, actionTemplate, next){
        connection.response._processorNoteLate = 'late';
        next(connection, true);
      }, api.config.general.defaultProcessorPriority+1);
      
      api.specHelper.runAction('randomNumber', function(response){
        response._processorNoteFirst.should.equal('first');
        response._processorNoteEarly.should.equal('early');
        response._processorNoteDefault.should.equal('default');
        response._processorNoteLate.should.equal('late');
        done();
      });
    });
    
    it('multiple preProcessors with same priority are executed', function(done){
      api.actions.addPreProcessor(function(connection, actionTemplate, next){
        connection.response._processorNoteFirst = 'first';
        next(connection, true);
      }, api.config.general.defaultProcessorPriority-1);
      
      api.actions.addPreProcessor(function(connection, actionTemplate, next){
        connection.response._processorNoteSecond = 'second';
        next(connection, true);
      }, api.config.general.defaultProcessorPriority-1);
      
      api.specHelper.runAction('randomNumber', function(response){
        response._processorNoteFirst.should.equal('first');
        response._processorNoteSecond.should.equal('second');
        done();
      });
    });

    it('postProcessors can append the connection', function(done){
      api.actions.addPostProcessor(function(connection, actionTemplate, toRender, next){
        connection.response._postProcessorNote = 'note'
        next(connection, true);
      });

      api.specHelper.runAction('randomNumber', function(response){
        response._postProcessorNote.should.equal('note');
        done();
      });
    })

    it('postProcessors with priorities run in the right order', function(done){
      // first priority
      api.actions.addPostProcessor(function(connection, actionTemplate, toRender, next){
        connection.response._processorNoteFirst = 'first';
        connection.response._processorNoteEarly = 'first';
        connection.response._processorNoteLate = 'first';
        connection.response._processorNoteDefault = 'first';
        next(connection, true);
      }, 1);
      
      // lower number priority (runs sooner)
      api.actions.addPostProcessor(function(connection, actionTemplate, toRender, next){
        connection.response._processorNoteEarly = 'early';
        connection.response._processorNoteLate = 'early';
        connection.response._processorNoteDefault = 'early';
        next(connection, true);
      }, api.config.general.defaultProcessorPriority-1);
      
      // old style "default" priority
      api.actions.addPostProcessor(function(connection, actionTemplate, toRender, next){
        connection.response._processorNoteLate = 'default';
        connection.response._processorNoteDefault = 'default';
        next(connection, true);
      });
      
      // higher number priority (runs later)
      api.actions.addPostProcessor(function(connection, actionTemplate, toRender, next){
        connection.response._processorNoteLate = 'late';
        next(connection, true);
      }, api.config.general.defaultProcessorPriority+1);
      
      api.specHelper.runAction('randomNumber', function(response){
        response._processorNoteFirst.should.equal('first');
        response._processorNoteEarly.should.equal('early');
        response._processorNoteDefault.should.equal('default');
        response._processorNoteLate.should.equal('late');
        done();
      });
    });
    
    it('multiple postProcessors with same priority are executed', function(done){
      api.actions.addPostProcessor(function(connection, actionTemplate, toRender, next){
        connection.response._processorNoteFirst = 'first';
        next(connection, true);
      }, api.config.general.defaultProcessorPriority-1);
      
      api.actions.addPostProcessor(function(connection, actionTemplate, toRender, next){
        connection.response._processorNoteSecond = 'second';
        next(connection, true);
      }, api.config.general.defaultProcessorPriority-1);
      
      api.specHelper.runAction('randomNumber', function(response){
        response._processorNoteFirst.should.equal('first');
        response._processorNoteSecond.should.equal('second');
        done();
      });
    });

    it('preProcessors can block actions', function(done){
      api.actions.addPreProcessor(function(connection, actionTemplate, next){
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
      api.actions.addPostProcessor(function(connection, actionTemplate, toRender, next){
        next(connection, false);
      });

      api.specHelper.runAction('randomNumber', function(){
        throw new Error('should not get a response');
      });
      setTimeout(function(){
        done();
      }, 500);
    })
  })
  
  describe('middleware handling', function() {
    before(function(done) {
      api.actions.versions.middlewareAction = [1];
      api.actions.actions.middlewareAction = {
        '1': {
          name: 'middlewareAction',
          description: 'I am an example of using middleware defined on a per-action basis.',
          middleware: {
            preprocess: {
              'jwtSession': {},
              'quotaManager': {}
            },
            postprocess: {
              'requestAuditor': {}
            }
          },
          run: function(api, connection, next) {
            connection.response.status = 'OK';
            next(connection, true);
          }
        }
      };

      api.actions.addMiddleware('jwtSession', {
        preprocess: function(connection, actionTemplate, next) {
          connection.response.executed = 'A';
          next(connection, true);
        }
      });

      api.actions.addMiddleware('quotaManager', {
        preprocess: function(connection, actionTemplate, next) {
          connection.response.executed += 'B';
          next(connection, true);
        }
      });

      api.actions.addMiddleware('requestAuditor', {
        postprocess: function(connection, actionTemplate, toRender, next) {
          connection.response.executed += 'C';
          next(connection, toRender);
        }
      });

      api.routes.loadRoutes();
      done();
    });

    it('can use middleware in the correct order', function(done) {
      api.specHelper.runAction('middlewareAction', function(response, connection) {
        connection.response.status.should.equal('OK');
        connection.response.executed.should.equal('ABC');
        done();
      });
    });

    after(function(done) {
      delete api.actions.actions.middlewareAction;
      delete api.actions.versions.middlewareAction;
      done();
    });
  });

  describe('connection create/destroy callbacks', function(){

    beforeEach(function(done){
      api.connections.createCallbacks = {};
      api.connections.destroyCallbacks = {};
      done();
    })

    afterEach(function(done){
      api.connections.createCallbacks = {};
      api.connections.destroyCallbacks = {};
      done();
    })

    it('can create callbacks on connection creation', function(done){
      api.connections.addCreateCallback(function(){
        done();
      });
      api.specHelper.runAction('randomNumber', function(){
        //
      });
    });

    it('can create callbacks on connection destroy', function(done){
      api.connections.addDestroyCallback(function(){
        done();
      });

      api.specHelper.runAction('randomNumber', function(response, connection){
        connection.destroy();
      });
    })

  })

});
