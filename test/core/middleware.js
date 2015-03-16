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
    done();
  });
  
  describe('action preProcessors', function(){

    it('I can define an action preProcessor and it can append the connection', function(done){
      api.actions.addPreProcessor(function(data, next){
        data.response._preProcessorNote = 'note'
        next();
      });

      api.specHelper.runAction('randomNumber', function(response){
        response._preProcessorNote.should.equal('note');
        done();
      });
    });
    
    it('preProcessors with priorities run in the right order', function(done){
      // first priority
      api.actions.addPreProcessor(function(data, next){
        data.response._processorNoteFirst = 'first';
        data.response._processorNoteEarly = 'first';
        data.response._processorNoteLate = 'first';
        data.response._processorNoteDefault = 'first';
        next();
      }, 1);
      
      // lower number priority (runs sooner)
      api.actions.addPreProcessor(function(data, next){
        data.response._processorNoteEarly = 'early';
        data.response._processorNoteLate = 'early';
        data.response._processorNoteDefault = 'early';
        next();
      }, api.config.general.defaultProcessorPriority-1);
      
      // old style "default" priority
      api.actions.addPreProcessor(function(data, next){
        data.response._processorNoteLate = 'default';
        data.response._processorNoteDefault = 'default';
        next();
      });
      
      // higher number priority (runs later)
      api.actions.addPreProcessor(function(data, next){
        data.response._processorNoteLate = 'late';
        next();
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
      api.actions.addPreProcessor(function(data, next){
        data.response._processorNoteFirst = 'first';
        next();
      }, api.config.general.defaultProcessorPriority-1);
      
      api.actions.addPreProcessor(function(data, next){
        data.response._processorNoteSecond = 'second';
        next();
      }, api.config.general.defaultProcessorPriority-1);
      
      api.specHelper.runAction('randomNumber', function(response){
        response._processorNoteFirst.should.equal('first');
        response._processorNoteSecond.should.equal('second');
        done();
      });
    });

    it('postProcessors can append the connection', function(done){
      api.actions.addPostProcessor(function(data, next){
        data.response._postProcessorNote = 'note'
        next();
      });

      api.specHelper.runAction('randomNumber', function(response){
        response._postProcessorNote.should.equal('note');
        done();
      });
    })

    it('postProcessors with priorities run in the right order', function(done){
      // first priority
      api.actions.addPostProcessor(function(data, next){
        data.response._processorNoteFirst = 'first';
        data.response._processorNoteEarly = 'first';
        data.response._processorNoteLate = 'first';
        data.response._processorNoteDefault = 'first';
        next();
      }, 1);
      
      // lower number priority (runs sooner)
      api.actions.addPostProcessor(function(data, next){
        data.response._processorNoteEarly = 'early';
        data.response._processorNoteLate = 'early';
        data.response._processorNoteDefault = 'early';
        next();
      }, api.config.general.defaultProcessorPriority-1);
      
      // old style "default" priority
      api.actions.addPostProcessor(function(data, next){
        data.response._processorNoteLate = 'default';
        data.response._processorNoteDefault = 'default';
        next();
      });
      
      // higher number priority (runs later)
      api.actions.addPostProcessor(function(data, next){
        data.response._processorNoteLate = 'late';
        next();
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
      api.actions.addPostProcessor(function(data, next){
        data.response._processorNoteFirst = 'first';
        next();
      }, api.config.general.defaultProcessorPriority-1);
      
      api.actions.addPostProcessor(function(data, next){
        data.response._processorNoteSecond = 'second';
        next();
      }, api.config.general.defaultProcessorPriority-1);
      
      api.specHelper.runAction('randomNumber', function(response){
        response._processorNoteFirst.should.equal('first');
        response._processorNoteSecond.should.equal('second');
        done();
      });
    });

    it('preProcessors can block actions', function(done){
      api.actions.addPreProcessor(function(data, next){
        next(new Error( 'BLOCKED' ));
      });

      api.specHelper.runAction('randomNumber', function(response){
        response.error.should.equal('Error: BLOCKED');
        should.not.exist(response.randomNumber);
        done();
      });
    })

    it('postProcessors can modify toRender', function(done){
      api.actions.addPostProcessor(function(data, next){
        data.toRender = false;
        next();
      });

      api.specHelper.runAction('randomNumber', function(){
        throw new Error('should not get a response');
      });
      setTimeout(function(){
        done();
      }, 1000);
    })
  
  })

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
