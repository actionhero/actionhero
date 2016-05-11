var should = require('should');
var actionheroPrototype = require(__dirname + '/../../actionhero.js').actionheroPrototype;
var actionhero = new actionheroPrototype();
var api;

describe('Core: Middleware', function(){

  before(function(done){
    actionhero.start(function(error, a){
      api = a;
      done();
    });
  });

  after(function(done){
    actionhero.stop(function(){
      done();
    });
  });

  afterEach(function(done){
    api.actions.middleware  = {};
    api.actions.globalMiddleware = [];
    done();
  });

  describe('action preProcessors', function(){

    it('I can define a global preProcessor and it can append the connection', function(done){
      api.actions.addMiddleware({
        name: 'test middleware',
        global: true,
        preProcessor: function(data, next){
          data.response._preProcessorNote = 'note';
          next();
        }
      });

      api.specHelper.runAction('randomNumber', function(response){
        response._preProcessorNote.should.equal('note');
        done();
      });
    });

    it('I can define a local preProcessor and it will not append the connection', function(done){
      api.actions.addMiddleware({
        name: 'test middleware',
        global: false,
        preProcessor: function(data, next){
          data.response._preProcessorNote = 'note';
          next();
        }
      });

      api.specHelper.runAction('randomNumber', function(response){
        should.not.exist(response._preProcessorNote);
        done();
      });
    });

    it('preProcessors with priorities run in the right order', function(done){
      // first priority
      api.actions.addMiddleware({
        name: 'first test middleware',
        global: true,
        priority: 1,
        preProcessor: function(data, next){
          data.response._processorNoteFirst = 'first';
          data.response._processorNoteEarly = 'first';
          data.response._processorNoteLate = 'first';
          data.response._processorNoteDefault = 'first';
          next();
        }
      });

      // lower number priority (runs sooner)
      api.actions.addMiddleware({
        name: 'early test middleware',
        global: true,
        priority: api.config.general.defaultProcessorPriority - 1,
        preProcessor: function(data, next){
          data.response._processorNoteEarly = 'early';
          data.response._processorNoteLate = 'early';
          data.response._processorNoteDefault = 'early';
          next();
        }
      });

      // old style "default" priority
      api.actions.addMiddleware({
        name: 'default test middleware',
        global: true,
        preProcessor: function(data, next){
          data.response._processorNoteLate = 'default';
          data.response._processorNoteDefault = 'default';
          next();
        }
      });

      // higher number priority (runs later)
      api.actions.addMiddleware({
        name: 'late test middleware',
        global: true,
        priority: api.config.general.defaultProcessorPriority + 1,
        preProcessor: function(data, next){
          data.response._processorNoteLate = 'late';
          next();
        }
      });

      api.specHelper.runAction('randomNumber', function(response){
        response._processorNoteFirst.should.equal('first');
        response._processorNoteEarly.should.equal('early');
        response._processorNoteDefault.should.equal('default');
        response._processorNoteLate.should.equal('late');
        done();
      });
    });

    it('multiple preProcessors with same priority are executed', function(done){
      api.actions.addMiddleware({
        name: 'first test middleware',
        global: true,
        priority: api.config.general.defaultProcessorPriority - 1,
        preProcessor: function(data, next){
          data.response._processorNoteFirst = 'first';
          next();
        }
      });

      api.actions.addMiddleware({
        name: 'late test middleware',
        global: true,
        priority: api.config.general.defaultProcessorPriority - 1,
        preProcessor: function(data, next){
          data.response._processorNoteSecond = 'second';
          next();
        }
      });

      api.specHelper.runAction('randomNumber', function(response){
        response._processorNoteFirst.should.equal('first');
        response._processorNoteSecond.should.equal('second');
        done();
      });
    });

    it('postProcessors can append the connection', function(done){
      api.actions.addMiddleware({
        name: 'test middleware',
        global: true,
        postProcessor: function(data, next){
          data.response._postProcessorNote = 'note';
          next();
        }
      });

      api.specHelper.runAction('randomNumber', function(response){
        response._postProcessorNote.should.equal('note');
        done();
      });
    });

    it('postProcessors with priorities run in the right order', function(done){
      // first priority
      api.actions.addMiddleware({
        name: 'first test middleware',
        global: true,
        priority: 1,
        postProcessor: function(data, next){
          data.response._processorNoteFirst = 'first';
          data.response._processorNoteEarly = 'first';
          data.response._processorNoteLate = 'first';
          data.response._processorNoteDefault = 'first';
          next();
        }
      });

      // lower number priority (runs sooner)
      api.actions.addMiddleware({
        name: 'early test middleware',
        global: true,
        priority: api.config.general.defaultProcessorPriority - 1,
        postProcessor: function(data, next){
          data.response._processorNoteEarly = 'early';
          data.response._processorNoteLate = 'early';
          data.response._processorNoteDefault = 'early';
          next();
        }
      });

      // old style "default" priority
      api.actions.addMiddleware({
        name: 'default test middleware',
        global: true,
        postProcessor: function(data, next){
          data.response._processorNoteLate = 'default';
          data.response._processorNoteDefault = 'default';
          next();
        }
      });

      // higher number priority (runs later)
      api.actions.addMiddleware({
        name: 'late test middleware',
        global: true,
        priority: api.config.general.defaultProcessorPriority + 1,
        postProcessor: function(data, next){
          data.response._processorNoteLate = 'late';
          next();
        }
      });

      api.specHelper.runAction('randomNumber', function(response){
        response._processorNoteFirst.should.equal('first');
        response._processorNoteEarly.should.equal('early');
        response._processorNoteDefault.should.equal('default');
        response._processorNoteLate.should.equal('late');
        done();
      });
    });

    it('multiple postProcessors with same priority are executed', function(done){
      api.actions.addMiddleware({
        name: 'first middleware',
        global: true,
        priority: api.config.general.defaultProcessorPriority - 1,
        postProcessor: function(data, next){
          data.response._processorNoteFirst = 'first';
          next();
        }
      });

      api.actions.addMiddleware({
        name: 'second middleware',
        global: true,
        priority: api.config.general.defaultProcessorPriority - 1,
        postProcessor: function(data, next){
          data.response._processorNoteSecond = 'second';
          next();
        }
      });

      api.specHelper.runAction('randomNumber', function(response){
        response._processorNoteFirst.should.equal('first');
        response._processorNoteSecond.should.equal('second');
        done();
      });
    });

    it('preProcessors can block actions', function(done){
      api.actions.addMiddleware({
        name: 'test middleware',
        global: true,
        preProcessor: function(data, next){
          next(new Error('BLOCKED'));
        }
      });

      api.specHelper.runAction('randomNumber', function(response){
        response.error.should.equal('Error: BLOCKED');
        should.not.exist(response.randomNumber);
        done();
      });
    });

    it('postProcessors can modify toRender', function(done){
      api.actions.addMiddleware({
        name: 'test middleware',
        global: true,
        postProcessor: function(data, next){
          data.toRender = false;
          next();
        }
      });

      api.specHelper.runAction('randomNumber', function(){
        throw new Error('should not get a response');
      });
      setTimeout(function(){
        done();
      }, 1000);
    });

  });

  describe('connection create/destroy callbacks', function(){

    beforeEach(function(done){
      api.connections.middleware = {};
      api.connections.globalMiddleware = [];
      done();
    });

    afterEach(function(done){
      api.connections.middleware = {};
      api.connections.globalMiddleware = [];
      done();
    });

    it('can create callbacks on connection creation', function(done){
      api.connections.addMiddleware({
        name: 'connection middleware',
        create: function(){
          done();
        }
      });
      api.specHelper.runAction('randomNumber', function(){
        //
      });
    });

    it('can create callbacks on connection destroy', function(done){
      api.connections.addMiddleware({
        name: 'connection middleware',
        destroy: function(){
          done();
        }
      });

      api.specHelper.runAction('randomNumber', function(response, connection){
        connection.destroy();
      });
    });

  });

});
