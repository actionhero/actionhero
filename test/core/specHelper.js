var should = require('should');
var actionheroPrototype = require(__dirname + '/../../actionhero.js').actionheroPrototype;
var actionhero = new actionheroPrototype();
var api;

describe('Core: specHelper', function(){

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

  it('can make a requset with just params', function(done){
    api.specHelper.runAction('randomNumber', function(response){
      response.randomNumber.should.be.a.Number;
      response.randomNumber.should.be.within(0,1);
      done();
    });
  });

  it('will return metadata like the web server', function(done){
    api.specHelper.runAction('x', {thing: 'stuff'}, function(response){
      response.error.should.equal('Error: unknown action or invalid apiVersion');
      response.messageCount.should.equal(1);
      response.serverInformation.serverName.should.equal('actionhero API');
      response.requesterInformation.remoteIP.should.equal('testServer');
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

  describe('test callbacks', function(){

    it('will not report a broken test as a broken action (sync)', function(done){
      api.specHelper.runAction('randomNumber', function(response){
        try{
          response.not.a.real.thing
        }catch(e){
          String(e).should.equal('TypeError: Cannot read property \'a\' of undefined');
          done();
        }
      });
    });

    it('will not report a broken test as a broken action (async)', function(done){
      api.specHelper.runAction('sleepTest', function(response){
        try{
          response.thing.should.equal('this will break')
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
        data.error.should.equal( api.config.errors.fileNotFound() );
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
      }
      connId = conn.id;
      api.specHelper.runAction('cacheTest', conn, function(response, connection){
        response.messageCount.should.equal(1);
        connection.messages.length.should.equal(2);
        connId.should.equal(connection.id);
        done();
      });
    });

    it('can make second request', function(done){
      api.specHelper.runAction('randomNumber', conn, function(response, connection){
        response.messageCount.should.equal(2);
        connection.messages.length.should.equal(3);
        connId.should.equal(connection.id);
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
      }

      api.tasks.jobs.testTask  = api.tasks.jobWrapper('testTask');
      done();
    });

    after(function(done){
      delete api.testOutput
      delete api.tasks.tasks.testTask;
      done();
    });

    it('can run tasks', function(done){
      api.specHelper.runTask('testTask', {}, function(response){
        response.should.equal('OK');
        api.testOutput.should.equal('OK');
        done();
      })
    });

  });

});
