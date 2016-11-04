var should = require('should');
var actionheroPrototype = require(__dirname + '/../../actionhero.js').actionheroPrototype;
var actionhero = new actionheroPrototype();
var api;

describe('Core: specHelper', function(){

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

  it('can make a requset with just params', function(done){
    api.specHelper.runAction('randomNumber', function(response){
      response.randomNumber.should.be.a.Number;
      response.randomNumber.should.be.within(0, 1);
      done();
    });
  });

  it('will stack up messages recieved', function(done){
    api.specHelper.runAction('x', {thing: 'stuff'}, function(response, connection){
      connection.messages.length.should.equal(2);
      connection.messages[0].welcome.should.equal('Hello! Welcome to the actionhero api');
      connection.messages[1].error.should.equal('Error: unknown action or invalid apiVersion');
      done();
    });
  });

  describe('metadata, type-saftey, and errors', function(){
    before(function(){
      api.actions.versions.stringResponseTestAction = [1];
      api.actions.actions.stringResponseTestAction = {
        '1': {
          name: 'stringResponseTestAction',
          description: 'stringResponseTestAction',
          version: 1,
          run:function(api, data, next){
            data.response = 'something response';
            next();
          }
        }
      };

      api.actions.versions.stringErrorTestAction = [1];
      api.actions.actions.stringErrorTestAction = {
        '1': {
          name: 'stringErrorTestAction',
          description: 'stringErrorTestAction',
          version: 1,
          run:function(api, data, next){
            data.response = 'something response';
            next('some error');
          }
        }
      };

      api.actions.versions.arrayResponseTestAction = [1];
      api.actions.actions.arrayResponseTestAction = {
        '1': {
          name: 'arrayResponseTestAction',
          description: 'arrayResponseTestAction',
          version: 1,
          run:function(api, data, next){
            data.response = [1, 2, 3];
            next();
          }
        }
      };

      api.actions.versions.arrayErrorTestAction = [1];
      api.actions.actions.arrayErrorTestAction = {
        '1': {
          name: 'arrayErrorTestAction',
          description: 'arrayErrorTestAction',
          version: 1,
          run:function(api, data, next){
            data.response = [1, 2, 3];
            next('some error');
          }
        }
      };
    });

    after(function(){
      delete api.actions.actions.stringResponseTestAction;
      delete api.actions.versions.stringResponseTestAction;
      delete api.actions.actions.stringErrorTestAction;
      delete api.actions.versions.stringErrorTestAction;
      delete api.actions.actions.arrayResponseTestAction;
      delete api.actions.versions.arrayResponseTestAction;
      delete api.actions.actions.arrayErrorTestAction;
      delete api.actions.versions.arrayErrorTestAction;
    });

    describe('happy-path', function(){
      it('if the response payload is an object, it appends metadata', function(done){
        api.specHelper.runAction('randomNumber', function(response){
          should.not.exist(response.error);
          should.exist(response.randomNumber);
          response.messageCount.should.equal(1);
          response.serverInformation.serverName.should.equal('actionhero');
          response.requesterInformation.remoteIP.should.equal('testServer');
          done();
        });
      });

      it('if the response payload is a string, it maintains type', function(done){
        api.specHelper.runAction('stringResponseTestAction', function(response){
          response.should.deepEqual('something response');
          should.not.exist(response.error);
          should.not.exist(response.messageCount);
          should.not.exist(response.serverInformation);
          should.not.exist(response.requesterInformation);
          done();
        });
      });

      it('if the response payload is a array, it maintains type', function(done){
        api.specHelper.runAction('arrayResponseTestAction', function(response){
          response.should.deepEqual([1, 2, 3]);
          should.not.exist(response.error);
          should.not.exist(response.messageCount);
          should.not.exist(response.serverInformation);
          should.not.exist(response.requesterInformation);
          done();
        });
      });
    });

    describe('disabling metadata', function(){
      before(function(){ api.specHelper.returnMetadata = false; });
      after(function(){ api.specHelper.returnMetadata = true; });

      it('if the response payload is an object, it should not append metadata', function(done){
        api.specHelper.runAction('randomNumber', function(response){
          should.not.exist(response.error);
          should.exist(response.randomNumber);
          should.not.exist(response.messageCount);
          should.not.exist(response.serverInformation);
          should.not.exist(response.requesterInformation);
          done();
        });
      });
    });

    describe('errors', function(){

      it('if the response payload is an object and there is an error, it appends metadata', function(done){
        api.specHelper.runAction('x', function(response){
          response.error.should.equal('Error: unknown action or invalid apiVersion');
          response.messageCount.should.equal(1);
          response.serverInformation.serverName.should.equal('actionhero');
          response.requesterInformation.remoteIP.should.equal('testServer');
          done();
        });
      });

      it('if the response payload is a string, just the error will be returned', function(done){
        api.specHelper.runAction('stringErrorTestAction', function(response){
          response.should.equal('Error: some error');
          should.not.exist(response.messageCount);
          should.not.exist(response.serverInformation);
          should.not.exist(response.requesterInformation);
          done();
        });
      });

      it('if the response payload is a array, just the error will be returned', function(done){
        api.specHelper.runAction('arrayErrorTestAction', function(response){
          response.should.equal('Error: some error');
          should.not.exist(response.messageCount);
          should.not.exist(response.serverInformation);
          should.not.exist(response.requesterInformation);
          done();
        });
      });
    });
  });

  describe('test callbacks', function(){

    it('will not report a broken test as a broken action (sync)', function(done){
      api.specHelper.runAction('randomNumber', function(response){
        try{
          response.not.a.real.thing;
        }catch(e){
          String(e).should.equal('TypeError: Cannot read property \'a\' of undefined');
          done();
        }
      });
    });

    it('will not report a broken test as a broken action (async)', function(done){
      api.specHelper.runAction('sleepTest', function(response){
        try{
          response.thing.should.equal('this will break');
        }catch(e){
          String(e).should.equal('TypeError: Cannot read property \'should\' of undefined');
          done();
        }
      });
    });

  });

  describe('files', function(){
    it('can request file data', function(done){
      api.specHelper.getStaticFile('simple.html', function(data){
        should.not.exist(data.error);
        data.content.should.equal('<h1>ActionHero</h1>\\nI am a flat file being served to you via the API from ./public/simple.html<br />');
        data.mime.should.equal('text/html');
        data.length.should.equal(101);
        done();
      });
    });

    it('missing files', function(done){
      api.specHelper.getStaticFile('missing.html', function(data){
        data.error.should.equal('That file is not found');
        data.mime.should.equal('text/html');
        should.not.exist(data.content);
        done();
      });
    });
  });

  describe('persistent test connections', function(){

    var conn;
    var connId;

    it('can make a requset with a spec\'d connection', function(done){
      conn = new api.specHelper.connection();
      conn.params = {
        key: 'someKey',
        value: 'someValue',
      };
      connId = conn.id;
      api.specHelper.runAction('cacheTest', conn, function(response, connection){
        response.messageCount.should.equal(1);
        connection.messages.length.should.equal(2);
        connId.should.equal(connection.id);
        conn.fingerprint.should.equal(connId);
        done();
      });
    });

    it('can make second request', function(done){
      api.specHelper.runAction('randomNumber', conn, function(response, connection){
        response.messageCount.should.equal(2);
        connection.messages.length.should.equal(3);
        connId.should.equal(connection.id);
        conn.fingerprint.should.equal(connId);
        done();
      });
    });

    it('will generate new ids and fingerprints for a new connection', function(done){
      api.specHelper.runAction('randomNumber', {}, function(response, connection){
        response.messageCount.should.equal(1);
        connection.id.should.not.equal(connId);
        connection.fingerprint.should.not.equal(connId);
        done();
      });
    });
  });

  describe('tasks', function(){

    before(function(done){
      api.tasks.tasks.testTask = {
        name: 'testTask',
        description: 'task: ' + this.name,
        queue: 'default',
        frequency: 0,
        plugins: [],
        pluginOptions: {},
        run: function(api, params, next){
          api.testOutput = 'OK'; // test modifying the api pbject
          next('OK');
        }
      };

      api.tasks.jobs.testTask  = api.tasks.jobWrapper('testTask');
      done();
    });

    after(function(done){
      delete api.testOutput;
      delete api.tasks.tasks.testTask;
      done();
    });

    it('can run tasks', function(done){
      api.specHelper.runTask('testTask', {}, function(response){
        response.should.equal('OK');
        api.testOutput.should.equal('OK');
        done();
      });
    });

  });

});
