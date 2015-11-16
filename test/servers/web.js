var should  = require('should');
var request = require('request');
var fs      = require('fs');
var actionheroPrototype = require(__dirname + '/../../actionhero.js').actionheroPrototype;
var actionhero = new actionheroPrototype();
var api;
var url

describe('Server: Web', function(){

  before(function(done){
    actionhero.start(function(err, a){
      api = a;
      url = 'http://localhost:' + api.config.servers.web.port;
      done();
    })
  });

  after(function(done){
    actionhero.stop(function(){
      done();
    });
  });

  it('Server should be up and return data', function(done){
    request.get(url + '/api/', function(err, response, body){
      body = JSON.parse(body);
      body.should.be.an.instanceOf(Object);
      done();
    });
  });

  it('Server basic response should be JSON and have basic data', function(done){
    request.get(url + '/api/', function(err, response, body){
      body = JSON.parse(body);
      body.should.be.an.instanceOf(Object);
      body.requesterInformation.should.be.an.instanceOf(Object);
      done();
    });
  });

  it('params work', function(done){
    request.get(url + '/api?key=value', function(err, response, body){
      body = JSON.parse(body);
      body.requesterInformation.receivedParams.key.should.equal('value')
      done();
    });
  });

  it('params are ignored unless they are in the whitelist', function(done){
    request.get(url + '/api?crazyParam123=something', function(err, response, body){
      body = JSON.parse(body);
      should.not.exist(body.requesterInformation.receivedParams.crazyParam123);
      done();
    });
  });

  describe('will properly destroy connections', function(){

    it('works for the API', function(done){
      api.utils.hashLength( api.connections.connections ).should.equal(0);
      request.get(url + '/api/sleepTest', function(){
        api.utils.hashLength( api.connections.connections ).should.equal(0);
        setTimeout(done, 100);
      });

      setTimeout(function(){
        api.utils.hashLength( api.connections.connections ).should.equal(1);
      }, 100);
    });

    it('works for files', function(done){
      api.utils.hashLength( api.connections.connections ).should.equal(0);
      request.get(url + '/simple.html', function(){
        setTimeout(function(){
          api.utils.hashLength( api.connections.connections ).should.equal(0);
          done();
        }, 100);
      });
    });
  });

  describe('errors', function(){

    before(function(done){
      api.actions.versions.stringErrorTestAction = [1]
      api.actions.actions.stringErrorTestAction = {
        '1': {
          name: 'stringErrorTestAction',
          description: 'stringErrorTestAction',
          version: 1,
          run:function(api, data, next){
            next('broken');
          }
        }
      }

      api.actions.versions.errorErrorTestAction = [1]
      api.actions.actions.errorErrorTestAction = {
        '1': {
          name: 'errorErrorTestAction',
          description: 'errorErrorTestAction',
          version: 1,
          run:function(api, data, next){
            next(new Error('broken'));
          }
        }
      }

      api.actions.versions.complexErrorTestAction = [1]
      api.actions.actions.complexErrorTestAction = {
        '1': {
          name: 'complexErrorTestAction',
          description: 'complexErrorTestAction',
          version: 1,
          run:function(api, data, next){
            next({ error: 'broken', reason: 'stuff'});
          }
        }
      }

      api.routes.loadRoutes();
      done();
    });

    after(function(done){
      delete api.actions.actions.stringErrorTestAction;
      delete api.actions.versions.stringErrorTestAction;
      delete api.actions.actions.errorErrorTestAction;
      delete api.actions.versions.errorErrorTestAction;
      delete api.actions.actions.complexErrorTestAction;
      delete api.actions.versions.complexErrorTestAction;
      done();
    });

    it('errors can be error strings', function(done){
      request.get(url + '/api/stringErrorTestAction/', function(err, response, body){
        body = JSON.parse(body);
        body.error.should.equal('broken')
        done();
      });
    });

    it('errors can be error objects and returned plainly', function(done){
      request.get(url + '/api/errorErrorTestAction/', function(err, response, body){
        body = JSON.parse(body);
        body.error.should.equal('broken')
        done();
      });
    }); 

    it('errors can be complex JSON payloads', function(done){
      request.get(url + '/api/complexErrorTestAction/', function(err, response, body){
        body = JSON.parse(body);
        body.error.error.should.equal('broken')
        body.error.reason.should.equal('stuff')
        done();
      });
    });

  });

  describe('if disableParamScrubbing is set ', function () {
    var orig;

    before(function(done) {
      orig = api.config.general.disableParamScrubbing;
      api.config.general.disableParamScrubbing = true;
      done();
    });

    after(function (done) {
      api.config.general.disableParamScrubbing = orig;
      done();
    })

      it('params are not ignored', function(done){
        request.get(url + '/api/testAction/?crazyParam123=something', function(err, response, body){
          body = JSON.parse(body);
          body.requesterInformation.receivedParams.crazyParam123.should.equal('something');
          done();
        });
      });

  });

  it('gibberish actions have the right response', function(done){
    request.get(url + '/api/IAMNOTANACTION', function(err, response, body){
      body = JSON.parse(body);
      body.error.should.equal('unknown action or invalid apiVersion')
      done();
    });
  });

  it('real actions do not have an error response', function(done){
    request.get(url + '/api/status', function(err, response, body){
      body = JSON.parse(body);
      should.not.exist(body.error);
      done();
    });
  });

  it('HTTP Verbs should work: GET', function(done){
    request.get(url + '/api/randomNumber', function(err, response, body){
      body = JSON.parse(body);
      body.randomNumber.should.be.within(0,1)
      done();
    });
  });

  it('HTTP Verbs should work: PUT', function(done){
    request.put(url + '/api/randomNumber', function(err, response, body){
      body = JSON.parse(body);
      body.randomNumber.should.be.within(0,10)
      done();
    });
  });

  it('HTTP Verbs should work: POST', function(done){
    request.post(url + '/api/randomNumber', function(err, response, body){
      body = JSON.parse(body);
      body.randomNumber.should.be.within(0,100)
      done();
    });
  });

  it('HTTP Verbs should work: DELETE', function(done){
    request.del(url + '/api/randomNumber', function(err, response, body){
      body = JSON.parse(body);
      body.randomNumber.should.be.within(0,1000)
      done();
    });
  });

  it('HTTP Verbs should work: Post with Form', function(done){
    request.post(url + '/api/cacheTest', {form: {key:'key', value: 'value'}}, function(err, response, body){
      body = JSON.parse(body);
      body.cacheTestResults.saveResp.should.eql(true);
      done();
    });
  });

  it('HTTP Verbs should work: Post with JSON Payload as body', function(done){
    var body = JSON.stringify({key:'key', value: 'value'});
    request.post(url + '/api/cacheTest', {'body': body, 'headers': {'Content-type': 'application/json'}}, function(err, response, body){
      body = JSON.parse(body);
      body.cacheTestResults.saveResp.should.eql(true);
      done();
    });
  });

  describe('connection.rawConnection.params', function () {
    before(function(done){
      api.actions.versions.paramTestAction = [1]
      api.actions.actions.paramTestAction = {
        '1': {
          name: 'paramTestAction',
          description: 'I return connection.rawConnection.params',
          version: 1,
          run:function(api, data, next){
            data.response = data.connection.rawConnection.params;
            next();
          }
        }
      }

      api.routes.loadRoutes();
      done();
    });

    after(function(done){
      delete api.actions.actions.paramTestAction;
      delete api.actions.versions.paramTestAction;
      done();
    });


    it('.query should contain unfiltered query params', function (done) {
      request.get(url + '/api/paramTestAction/?crazyParam123=something', function(err, response, body){
        body = JSON.parse(body);
        body.query.crazyParam123.should.equal('something');
        done();
      });
    })

    it('.body should contain unfiltered request body params', function (done) {
      var requestBody = JSON.stringify({key:'value'});
      request.post(url + '/api/paramTestAction', {'body': requestBody, 'headers': {'Content-type': 'application/json'}}, function(err, response, body){
        body = JSON.parse(body);
        body.body.key.should.eql('value');
        done();
      });
    })
  })

  it('returnErrorCodes false should still have a status of 200', function(done){
    api.config.servers.web.returnErrorCodes = false;
    request.del(url + '/api/', function(err, response, body){
      body = JSON.parse(body);
      response.statusCode.should.eql(200);
      done();
    });
  });

  it('returnErrorCodes can be opted to change http header codes', function(done){
    api.config.servers.web.returnErrorCodes = true;
    request.del(url + '/api/', function(err, response, body){
      body = JSON.parse(body);
      response.statusCode.should.eql(404);
      done();
    });
  });

  describe('http header', function(){

    before(function(done){
      api.config.servers.web.returnErrorCodes = true;
      api.actions.versions.headerTestAction = [1]
      api.actions.actions.headerTestAction = {
        '1': {
          name: 'headerTestAction',
          description: 'I am a test',
          version: 1,
          outputExample: {},
          run:function(api, data, next){
            data.connection.rawConnection.responseHeaders.push(['thing', 'A']);
            data.connection.rawConnection.responseHeaders.push(['thing', 'B']);
            data.connection.rawConnection.responseHeaders.push(['thing', 'C']);
            data.connection.rawConnection.responseHeaders.push(['Set-Cookie', 'value_1=1']);
            data.connection.rawConnection.responseHeaders.push(['Set-Cookie', 'value_2=2']);
            next();
          }
        }
      }

      api.routes.loadRoutes();
      done();
    });

    after(function(done){
      delete api.actions.actions.headerTestAction;
      delete api.actions.versions.headerTestAction;
      done();
    })

    it('duplicate headers should be removed (in favor of the last set)', function(done){
      request.get(url + '/api/headerTestAction', function(err, response, body){
        body = JSON.parse(body);
        response.statusCode.should.eql(200);
        response.headers.thing.should.eql('C');
        done();
      });
    });

    it('but duplicate set-cookie requests should be allowed', function(done){
      request.get(url + '/api/headerTestAction', function(err, response, body){
        body = JSON.parse(body);
        response.statusCode.should.eql(200);
        response.headers['set-cookie'].length.should.eql(3); // 2 + session
        response.headers['set-cookie'][1].should.eql('value_1=1');
        response.headers['set-cookie'][0].should.eql('value_2=2');
        done();
      });
    });

    it('should respond to OPTIONS with only HTTP headers', function(done){
      request({method: 'options', url: url + '/api/cacheTest'}, function(err, response){
        response.statusCode.should.eql(200);
        response.headers['access-control-allow-methods'].should.equal('HEAD, GET, POST, PUT, PATCH, DELETE, OPTIONS, TRACE');
        response.headers['access-control-allow-origin'].should.equal('*');
        response.headers['content-length'].should.equal('0');
        done();
      });
    });

    it('should respond to TRACE with parsed params received', function(done){
      request({method: 'trace', url: url + '/api/x', form: {key: 'someKey', value: 'someValue'}}, function(err, response, body){
        body = JSON.parse(body);
        response.statusCode.should.eql(200);
        body.receivedParams.key.should.equal('someKey');
        body.receivedParams.value.should.equal('someValue');
        done();
      });
    });

    it('should respond to HEAD requests just like GET, but with no body', function(done){
      request({method: 'head', url: url + '/api/headerTestAction'}, function(err, response, body){
        response.statusCode.should.eql(200);
        body.should.equal('');
        done();
      });
    });

    it('keeps sessions with browser_fingerprint', function(done){
      var j = request.jar()
      request.post({url: url+'/api', jar: j}, function(err, response1, body1){
        request.get({url: url+'/api', jar: j}, function(err, response2, body2){
          request.put({url: url+'/api', jar: j}, function(err, response3, body3){
            request.del({url: url+'/api', jar: j}, function(err, response4, body4){
              body1 = JSON.parse(body1);
              body2 = JSON.parse(body2);
              body3 = JSON.parse(body3);
              body4 = JSON.parse(body4);

              response1.headers['set-cookie'].should.exist;
              should.not.exist(response2.headers['set-cookie']);
              should.not.exist(response3.headers['set-cookie']);
              should.not.exist(response4.headers['set-cookie']);

              var fingerprint1 = body1.requesterInformation.id.split('-')[0];
              var fingerprint2 = body2.requesterInformation.id.split('-')[0];
              var fingerprint3 = body3.requesterInformation.id.split('-')[0];
              var fingerprint4 = body4.requesterInformation.id.split('-')[0];

              fingerprint1.should.equal(fingerprint2);
              fingerprint1.should.equal(fingerprint3);
              fingerprint1.should.equal(fingerprint4);

              fingerprint1.should.equal(body1.requesterInformation.fingerprint);
              fingerprint2.should.equal(body2.requesterInformation.fingerprint);
              fingerprint3.should.equal(body3.requesterInformation.fingerprint);
              fingerprint4.should.equal(body4.requesterInformation.fingerprint);
              done();
            });
          });
        });
      });
    });

  });

  describe('http returnErrorCodes true', function(){

    before(function(done){
      api.config.servers.web.returnErrorCodes = true;

      api.actions.versions.statusTestAction = [1]
      api.actions.actions.statusTestAction = {
        '1': {
          name: 'statusTestAction',
          description: 'I am a test',
          inputs: {
            key: {required:true}
          },
          run:function(api, data, next){
            var error;
            if(data.params.key !== 'value'){
              error = 'key != value';
              data.connection.rawConnection.responseHttpCode = 402;
            } else {
              data.response.good = true;
            }
            next(error);
          }
        }
      }

      api.actions.versions.brokenAction = [1]
      api.actions.actions.brokenAction = {
        '1': {
          name: 'brokenAction',
          description: 'I am broken',
          run:function(api, data, next){
            BREAK; // undefiend
            next();
          }
        }
      }

      api.routes.loadRoutes();
      done();
    });

    after(function(done){
      api.config.servers.web.returnErrorCodes = false;
      delete api.actions.versions.statusTestAction;
      delete api.actions.actions.statusTestAction;
      delete api.actions.versions.brokenAction;
      delete api.actions.actions.brokenAction;
      done();
    });

    it('actions that do not exists should return 404', function(done){
      request.post(url + '/api/aFakeAction', function(err, response, body){
        body = JSON.parse(body);
        response.statusCode.should.eql(404);
        done();
      });
    });

    it('missing params result in a 422', function(done){
      request.post(url + '/api/statusTestAction', function(err, response, body){
        body = JSON.parse(body);
        response.statusCode.should.eql(422);
        done();
      });
    });

    it('server errors should return a 500', function(done){
      if(api.config.general.actionDomains === true){
        request.post(url + '/api/brokenAction', function(err, response, body){
          body = JSON.parse(body);
          body.error.should.eql( 'The server experienced an internal error' );
          response.statusCode.should.eql(500);
          done();
        });
      }else{
        console.log("skipping broken action test; api.config.general.actionDomains != true")
        done();
      }
    });

    it('status codes can be set for errors', function(done){
      request.post(url + '/api/statusTestAction', {form: {key: 'bannana'}}, function(err, response, body){
        body = JSON.parse(body);
        body.error.should.eql('key != value');
        response.statusCode.should.eql(402);
        done();
      });
    });

    it('status code should still be 200 if everything is OK', function(done){
      request.post(url + '/api/statusTestAction', {form: {key: 'value'}}, function(err, response, body){
        body = JSON.parse(body);
        body.good.should.eql(true);
        response.statusCode.should.eql(200);
        done();
      });
    });

  });

  describe('documentation', function(){

    it('documentation can be returned via a documentation action', function(done){
      request.get(url + '/api/showDocumentation', function(err, response, body){
        body = JSON.parse(body);
        body.documentation.should.be.an.instanceOf(Object);
        done();
      });
    });

    it('should have actions with all the right parts', function(done){
      request.get(url + '/api/showDocumentation', function(err, response, body){
        body = JSON.parse(body);
        for(var actionName in body.documentation){
          for(var version in body.documentation[actionName]){
            var action = body.documentation[actionName][version];
            action.name.should.be.a.String;
            action.description.should.be.a.String;
            action.inputs.should.be.an.instanceOf(Object)
          }
        }
        done();
      });
    });

  });

  describe('files', function(){

    it('file: an HTML file', function(done){
      request.get(url + '/public/simple.html', function(err, response){
        response.statusCode.should.equal(200);
        response.body.should.equal('<h1>ActionHero</h1>\\nI am a flat file being served to you via the API from ./public/simple.html<br />');
        done();
      });
    });

    it('file: 404 pages', function(done){
      request.get(url + '/public/notARealFile', function(err, response){
        response.statusCode.should.equal(404)
        done();
      });
    });

    it('I should not see files outside of the public dir', function(done){
      request.get(url + '/public/../config.json', function(err, response){
        response.statusCode.should.equal(404);
        response.body.should.equal( api.config.errors.fileNotFound() );
        done();
      });
    });

    it('file: index page should be served when requesting a path (trailing slash)', function(done){
      request.get(url + '/public/', function(err, response){
        response.statusCode.should.equal(200);
        response.body.should.be.a.String;
        done();
      });
    });

    it('file: index page should be served when requesting a path (no trailing slash)', function(done){
      request.get(url + '/public', function(err, response){
        response.statusCode.should.equal(200);
        response.body.should.be.a.String;
        done();
      });
    });

    describe('can serve files from more than one directory', function(){
      var source = __dirname + '/../../public/simple.html'

      before(function(done){
        fs.createReadStream(source).pipe(fs.createWriteStream('/tmp/testFile.html'));
        api.config.general.paths.public.push('/tmp');
        process.nextTick(function(){
          done();
        });
      });

      after(function(done){
        fs.unlink('/tmp/testFile.html');
        api.config.general.paths.public.pop();
        process.nextTick(function(){
          done();
        });
      });

      it('works for secondary paths', function(done){
        request.get(url + '/public/testFile.html', function(err, response){
          response.statusCode.should.equal(200);
          response.body.should.equal('<h1>ActionHero</h1>\\nI am a flat file being served to you via the API from ./public/simple.html<br />');
          done();
        });
      });
    });

    describe('depth routes', function(){
      before(function(){
        api.config.servers.web.urlPathForActions = '/craz/y/action/path'
        api.config.servers.web.urlPathForFiles = '/a/b/c'
      })

      after(function(){
        api.config.servers.web.urlPathForActions = 'api'
        api.config.servers.web.urlPathForFiles = 'public'
      })

      it('old action routes stop working', function(done){
        request.get(url + '/api/randomNumber', function(err, response){
          response.statusCode.should.equal(404);
          done();
        });
      });

      it('can ask for nested URL actions', function(done){
        request.get(url + '/craz/y/action/path/randomNumber', function(err, response){
          response.statusCode.should.equal(200);
          done();
        });
      });

      it('old file routes stop working', function(done){
        request.get(url + '/public/simple.html', function(err, response){
          response.statusCode.should.equal(404);
          done();
        });
      });

      it('can ask for nested URL files', function(done){
        request.get(url + '/a/b/c/simple.html', function(err, response){
          response.statusCode.should.equal(200);
          response.body.should.equal('<h1>ActionHero</h1>\\nI am a flat file being served to you via the API from ./public/simple.html<br />');
          done();
        });
      });

      it('can ask for nested URL files with depth', function(done){
        request.get(url + '/a/b/c/css/actionhero.css', function(err, response){
          response.statusCode.should.equal(200);
          done();
        });
      });
    });

  });

  describe('routes', function(){

    before(function(done){
      api.actions.versions.mimeTestAction = [1]
      api.actions.actions.mimeTestAction = {
        '1': {
          name: 'mimeTestAction',
          description: 'I am a test',
          matchExtensionMimeType: true,
          inputs: {
            key: {required:true}
          },
          outputExample: {},
          run:function(api, data, next){
            next();
          }
        }
      }

      api.actions.versions.login = [1, 2]
      api.actions.actions.login = {
        '1': {
          name: 'login',
          description: 'login',
          matchExtensionMimeType: true,
          inputs: {
            user_id: {required:true}
          },
          outputExample: {},
          run:function(api, data, next){
            data.response.user_id = data.params.user_id;
            next();
          }
        },
        
        '2': {
          name: 'login',
          description: 'login',
          matchExtensionMimeType: true,
          inputs: {
            userID: {required:true}
          },
          outputExample: {},
          run:function(api, data, next){
            data.response.userID = data.params.userID;
            next();
          }
        }
      }

      api.params.buildPostVariables();
      api.routes.loadRoutes({
        all: [
          { path: '/user/:userID', action: 'user' }
        ],
        get: [
          { path: '/bogus/:bogusID', action: 'bogusAction' },
          { path: '/users', action: 'usersList' },
          { path: '/c/:key/:value', action: 'cacheTest' },
          { path: '/mimeTestAction/:key', action: 'mimeTestAction' },
          { path: '/thing', action: 'thing' },
          { path: '/thing/stuff', action: 'thingStuff' },
          { path: '/old_login', action: 'login', apiVersion: '1' }
        ],
        post: [
          { path: '/login/:userID(^(\\d{3}|admin)$)', action: 'login' }
        ]
      });

      done();
    });

    after(function(done){
      api.routes.routes = {};
      delete api.actions.versions.mimeTestAction;
      delete api.actions.actions.mimeTestAction;
      delete api.actions.versions.login;
      delete api.actions.actions.login;
      done();
    });

    it('new params will not be allowed in route definitions (an action should do it)', function(done){
      (api.params.postVariables.indexOf('bogusID') < 0).should.equal(true);
      done();
    });

    it('\'all\' routes are duplicated properly', function(done){
      ['get', 'post', 'put', 'delete'].forEach(function(verb){
        api.routes.routes[verb][0].action.should.equal('user');
        api.routes.routes[verb][0].path.should.equal('/user/:userID');
      });
      done();
    })

    it('unknown actions are still unknown', function(done){
      request.get(url + '/api/a_crazy_action', function(err, response, body){
        body = JSON.parse(body);
        body.error.should.equal('unknown action or invalid apiVersion')
        done();
      });
    });

    it('explicit action declarations still override routed actions, if the defined action is real', function(done){
      request.get(url + '/api/user/123?action=randomNumber', function(err, response, body){
        body = JSON.parse(body);
        body.requesterInformation.receivedParams.action.should.equal('randomNumber')
        done();
      });
    });

    it('route actions will override explicit actions, if the defined action is null', function(done){
      request.get(url + '/api/user/123?action=someFakeAction', function(err, response, body){
        body = JSON.parse(body);
        body.requesterInformation.receivedParams.action.should.equal('user')
        done();
      });
    });
    
    it('Routes should recognize apiVersion as default param', function(done){
      request.get(url + '/api/old_login?user_id=7', function(err, response, body){
        body = JSON.parse(body);
        body.user_id.should.equal('7');
        body.requesterInformation.receivedParams.action.should.equal('login')
        done();
      });
    });

    it('Routes should be mapped for GET (simple)', function(done){
      request.get(url + '/api/users', function(err, response, body){
        body = JSON.parse(body);
        body.requesterInformation.receivedParams.action.should.equal('usersList')
        done();
      });
    });

    it('Routes should be mapped for GET (complex)', function(done){
      request.get(url + '/api/user/1234', function(err, response, body){
        body = JSON.parse(body);
        body.requesterInformation.receivedParams.action.should.equal('user')
        body.requesterInformation.receivedParams.userID.should.equal('1234')
        done();
      });
    });

    it('Routes should be mapped for POST', function(done){
      request.post(url + '/api/user/1234?key=value', function(err, response, body){
        body = JSON.parse(body);
        body.requesterInformation.receivedParams.action.should.equal('user')
        body.requesterInformation.receivedParams.userID.should.equal('1234')
        body.requesterInformation.receivedParams.key.should.equal('value')
        done();
      });
    });

    it('Routes should be mapped for PUT', function(done){
      request.put(url + '/api/user/1234?key=value', function(err, response, body){
        body = JSON.parse(body);
        body.requesterInformation.receivedParams.action.should.equal('user')
        body.requesterInformation.receivedParams.userID.should.equal('1234')
        body.requesterInformation.receivedParams.key.should.equal('value')
        done();
      });
    });

    it('Routes should be mapped for DELETE', function(done){
      request.del(url + '/api/user/1234?key=value', function(err, response, body){
        body = JSON.parse(body);
        body.requesterInformation.receivedParams.action.should.equal('user')
        body.requesterInformation.receivedParams.userID.should.equal('1234')
        body.requesterInformation.receivedParams.key.should.equal('value')
        done();
      });
    });

    it('route params trump explicit params', function(done){
      request.get(url + '/api/user/1?userID=2', function(err, response, body){
        body = JSON.parse(body);
        body.requesterInformation.receivedParams.action.should.equal('user')
        body.requesterInformation.receivedParams.userID.should.equal('1')
        done();
      });
    });

    it('to match, a route much match all parts of the URL', function(done){
      request.get(url + '/api/thing', function(err, response, body){
        body = JSON.parse(body);
        body.requesterInformation.receivedParams.action.should.equal('thing')

        request.get(url + '/api/thing/stuff', function(err, response, body){
          body = JSON.parse(body);
          body.requesterInformation.receivedParams.action.should.equal('thingStuff')
          done();
        });
      });
    });

    it('regexp matches will provide proper variables', function(done){
      request.post(url + '/api/login/123', function(err, response, body){
        body = JSON.parse(body);
        body.requesterInformation.receivedParams.action.should.equal('login');
        body.requesterInformation.receivedParams.userID.should.equal('123');

        request.post(url + '/api/login/admin', function(err, response, body){
          body = JSON.parse(body);
          body.requesterInformation.receivedParams.action.should.equal('login');
          body.requesterInformation.receivedParams.userID.should.equal('admin');
          done();
        });
      });
    });

    it('regexp matches will still work with params with periods and other wacky chars', function(done){
      request.get(url + '/api/c/key/log_me-in.com$123.jpg', function(err, response, body){
        body = JSON.parse(body);
        body.requesterInformation.receivedParams.action.should.equal('cacheTest');
        body.requesterInformation.receivedParams.value.should.equal('log_me-in.com$123.jpg');
        done();
      });
    });

    it('regexp match failures will be rejected', function(done){
      request.post(url + '/api/login/1234', function(err, response, body){
        body = JSON.parse(body);
        body.error.should.equal('unknown action or invalid apiVersion');
        should.not.exist(body.requesterInformation.receivedParams.userID);
        done();
      });
    });

    describe('file extensions + routes', function(){

      it('will change header information based on extension (when active)', function(done){
        request.get(url + '/api/mimeTestAction/val.png', function(err, response){
          response.headers['content-type'].should.equal('image/png');
          done();
        });
      });

      it('will not change header information if there is a connection.error', function(done){
        request.get(url + '/api/mimeTestAction', function(err, response, body){
          body = JSON.parse(body);
          response.headers['content-type'].should.equal('application/json; charset=utf-8');
          body.error.should.equal('key is a required parameter for this action');
          done();
        });
      });

    });

  });

});
