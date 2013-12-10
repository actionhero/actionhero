describe('Server: Web', function(){

  var specHelper = require(__dirname + '/_specHelper.js').specHelper;
  var apiObj = {};
  var rawApi = {};
  var should = require('should');

  before(function(done){
    this.timeout(5000)
    specHelper.prepare(0, function(api){
      rawApi = api;
      apiObj = specHelper.cleanAPIObject(api);
      specHelper.resetCookieJar();
      done();
    })
  });

  it('Server should be up and return data', function(done){
    specHelper.apiTest.get('/api/', 0, {}, function(response, json){
      json.should.be.an.instanceOf(Object);
      done();
    });
  });

  it('Server basic response should be JSON and have basic data', function(done){
    specHelper.apiTest.get('/api/', 0, {}, function(response, json){
      json.should.be.an.instanceOf(Object);
      json.requesterInformation.should.be.an.instanceOf(Object);
      done();
    });
  });

  it('params work', function(done){
    specHelper.apiTest.get('/api/testAction/', 0, {}, function(response, json){
      json.requesterInformation.receivedParams.action.should.equal('testAction')
      done();
    });
  });

  it('params are ignored unless they are in the whitelist', function(done){
    specHelper.apiTest.get('/api/testAction/?crazyParam123=something', 0, {}, function(response, json){
      json.requesterInformation.receivedParams.action.should.equal('testAction');
      should.not.exist(json.requesterInformation.receivedParams['crazyParam123']);
      done();
    });
  });

  it('limit and offset should have defaults', function(done){
    specHelper.apiTest.get('/api/', 0, {}, function(response, json){
      json.requesterInformation.receivedParams.limit.should.equal(100)
      json.requesterInformation.receivedParams.offset.should.equal(0)
      done();
    });
  });

  it('gibberish actions have the right response', function(done){
    specHelper.apiTest.get('/api/IAMNOTANACTION', 0, {}, function(response, json){
      json.error.should.equal('Error: IAMNOTANACTION is not a known action or that is not a valid apiVersion.')
      done();
    });
  });

  it('real actions do not have an error response', function(done){
    specHelper.apiTest.get('/api/status', 0, {}, function(response, json){
      // response.body.error.should.equal('OK')
      should.not.exist(json.error);
      done();
    });
  });

  it('HTTP Verbs should work: GET', function(done){
    specHelper.apiTest.get('/api/randomNumber', 0, {}, function(response, json){
      json.randomNumber.should.be.within(0,1)
      done();
    });
  });

  it('HTTP Verbs should work: PUT', function(done){
    specHelper.apiTest.put('/api/randomNumber', 0, {}, function(response, json){
      json.randomNumber.should.be.within(0,10)
      done();
    });
  });

  it('HTTP Verbs should work: POST', function(done){
    specHelper.apiTest.post('/api/randomNumber', 0, {}, function(response, json){
      json.randomNumber.should.be.within(0,100)
      done();
    });
  });

  it('HTTP Verbs should work: DELETE', function(done){
    specHelper.apiTest.del('/api/randomNumber', 0, {}, function(response, json){
      json.randomNumber.should.be.within(0,1000)
      done();
    });
  });

  it('HTTP Verbs should work: Post with Form', function(done){
    var postURL = 'http://' + specHelper.url + ':' + (specHelper.startingWebPort + 0) + '/api/cacheTest';
    specHelper.request.post(postURL, {form: {key:'key', value: 'value'}}, function(err, response, body){
      body = JSON.parse(body);
      body.cacheTestResults.saveResp.should.eql(true);
      done();
    });
  });

  it('returnErrorCodes false should still have a status of 200', function(done){
    specHelper.apiTest.del('/api/', 0, {}, function(response, json){
      response.statusCode.should.eql(200);
      done();
    });
  });

  describe('http header', function(){

    before(function(done){
      rawApi.config.servers.web.returnErrorCodes = true;
      rawApi.actions.versions.headerTestAction = [1]
      rawApi.actions.actions.headerTestAction = {
        '1': {
          name: 'headerTestAction',
          description: 'I am a test',
          version: 1,
          inputs: { required: [], optional: [] },
          outputExample: {},
          run:function(api, connection, next){
            connection.rawConnection.responseHeaders.push(['thing', 'A']);
            connection.rawConnection.responseHeaders.push(['thing', 'B']);
            connection.rawConnection.responseHeaders.push(['thing', 'C']);
            connection.rawConnection.responseHeaders.push(['set-cookie', 'value 1']);
            connection.rawConnection.responseHeaders.push(['set-cookie', 'value 2']);
            next(connection, true);
          }
        }
      }
      done();
    });

    after(function(done){
      delete rawApi.actions.actions['headerTestAction'];
      delete rawApi.actions.versions['headerTestAction'];
      done();
    })

    it('duplicate cookies should be removed (in favor of the last set)', function(done){
      specHelper.apiTest.del('/api/headerTestAction', 0, {}, function(response, json){
        response.statusCode.should.eql(200);
        response.headers['thing'].should.eql('C');
        done();
      });
    });

    it('but duplicate set-cookie requests should be allowed', function(done){
      specHelper.apiTest.del('/api/headerTestAction', 0, {}, function(response, json){
        response.statusCode.should.eql(200);
        response.headers['set-cookie'].length.should.eql(2);
        response.headers['set-cookie'][1].should.eql('value 1');
        response.headers['set-cookie'][0].should.eql('value 2');
        done();
      });
    });

    it('should respond to OPTIONS with only HTTP headers', function(done){
      specHelper.apiTest.options('/api/x', 0, {}, function(response, json){
        response.statusCode.should.eql(200);
        response.headers['access-control-allow-methods'].should.equal('HEAD, GET, POST, PUT, DELETE, OPTIONS, TRACE');
        response.headers['access-control-allow-origin'].should.equal('*');
        response.headers['content-length'].should.equal('0');
        done();
      });
    });

    it('should respond to TRACE with parsed params received', function(done){
      specHelper.apiTest.trace('/api/x', 0, {key: 'someKey', value: 'someValue'}, function(response, json){
        response.statusCode.should.eql(200);
        json.receivedParams.action.should.equal('x');
        json.receivedParams.key.should.equal('someKey');
        json.receivedParams.value.should.equal('someValue');
        done();
      });
    });

    it('should respond to HEAD requests just like GET, but with no body', function(done){
      specHelper.apiTest.head('/api/randomNumber', 0, {}, function(response, json){
        response.statusCode.should.eql(200);
        should.not.exist(json);
        done();
      });
    });

  });

  describe('http returnErrorCodes true', function(){

    before(function(done){
      rawApi.config.servers.web.returnErrorCodes = true;
      rawApi.actions.versions.statusTestAction = [1]
      rawApi.actions.actions.statusTestAction = {
        '1': {
          name: 'statusTestAction',
          description: 'I am a test',
          inputs: { required: ['key'], optional: [] },
          outputExample: {},
          run:function(api, connection, next){
            if('value' !== connection.params.key){
              connection.error = 'key != value';
              connection.rawConnection.responseHttpCode = 402;
            } else {
              connection.response.good = true;
            }
            next(connection, true);
          }
        }
      }
      done();
    });

    after(function(done){
      rawApi.config.servers.web.returnErrorCodes = false;
      delete rawApi.actions.versions['statusTestAction'];
      delete rawApi.actions.actions['statusTestAction'];
      done();
    });

    it('actions that do not exists should return 404', function(done){
      specHelper.apiTest.del('/api/aFakeAction', 0, {}, function(response, json){
        response.statusCode.should.eql(404);
        done();
      });
    });

    it('missing params result in a 422', function(done){
      specHelper.apiTest.del('/api/statusTestAction', 0, {}, function(response, json){
        response.statusCode.should.eql(422);
        done();
      });
    });

    it('status codes can be set for errors', function(done){
      specHelper.apiTest.del('/api/statusTestAction', 0, {key: 'banana'}, function(response, json){
        json.error.should.eql('key != value');
        response.statusCode.should.eql(402);
        done();
      });
    });

    it('status code should still be 200 if everything is OK', function(done){
      specHelper.apiTest.del('/api/statusTestAction', 0, {key: 'value'}, function(response, json){
        json.good.should.eql(true);
        response.statusCode.should.eql(200);
        done();
      });
    });

  });

  describe('routes', function(){
    
    before(function(done){
      rawApi.routes.loadRoutes({
        all: [
          { path: '/user/:userID', action: 'user' }
        ],
        get: [
          { path: '/users', action: 'usersList' },
          { path: '/search/:term/limit/:limit/offset/:offset', action: 'search' },
          { path: '/c/:key/:value', action: 'cacheTest' },
          { path: '/mimeTestAction/:key', action: 'mimeTestAction' }
        ],
        post: [
          { path: '/login/:userID(^\\d{3}$)', action: 'login' }
        ]
      });

      rawApi.actions.versions.mimeTestAction = [1]
      rawApi.actions.actions.mimeTestAction = {
        '1': {
          name: 'mimeTestAction',
          description: 'I am a test',
          matchExtensionMimeType: true,
          inputs: { required: ['key'], optional: [] },
          outputExample: {},
          run:function(api, connection, next){
            next(connection, true);
          }
        }
      }

      done();
    });

    after(function(done){
      rawApi.routes.routes = {};
      delete rawApi.actions.versions['mimeTestAction'];
      delete rawApi.actions.actions['mimeTestAction'];
      done();
    });

    it('new params will be allowed in route definitions', function(done){
      rawApi.params.postVariables.should.include('userID');
      done();
    });

    it('\'all\' routes are duplicated properly', function(done){
      ['get', 'post', 'put', 'delete'].forEach(function(verb){
        rawApi.routes.routes[verb][0].action.should.equal('user');
        rawApi.routes.routes[verb][0].path.should.equal('/user/:userID');
      });
      done();
    })
  
    it('unknown actions are still unknown', function(done){
      specHelper.apiTest.get('/api/a_crazy_action', 0, {}, function(response, json){
        json.requesterInformation.receivedParams.action.should.equal('a_crazy_action')
        json.error.should.equal('Error: a_crazy_action is not a known action or that is not a valid apiVersion.')
        done();
      });
    });

    it('explicit action declarations still override routed actions, if the defined action is real', function(done){
      specHelper.apiTest.get('/api/user/123?action=randomNumber', 0, {}, function(response, json){
        json.requesterInformation.receivedParams.action.should.equal('randomNumber')
        done();
      });
    });

    it('route actions will override explicit actions, if the defined action is null', function(done){
      specHelper.apiTest.get('/api/user/123?action=someFakeAction', 0, {}, function(response, json){
        json.requesterInformation.receivedParams.action.should.equal('user')
        done();
      });
    });

    it('Routes should be mapped for GET (simple)', function(done){
      specHelper.apiTest.get('/api/users', 0, {}, function(response, json){
        json.requesterInformation.receivedParams.action.should.equal('usersList')
        done();
      });
    });

    it('Routes should be mapped for GET (complex)', function(done){
      specHelper.apiTest.get('/api/user/1234', 0, {}, function(response, json){
        json.requesterInformation.receivedParams.action.should.equal('user')
        json.requesterInformation.receivedParams.userID.should.equal('1234')
        done();
      });
    });

    it('Routes should be mapped for POST', function(done){
      specHelper.apiTest.post('/api/user/1234?key=value', 0, {}, function(response, json){
        json.requesterInformation.receivedParams.action.should.equal('user')
        json.requesterInformation.receivedParams.userID.should.equal('1234')
        json.requesterInformation.receivedParams.key.should.equal('value')
        done();
      });
    });

    it('Routes should be mapped for PUT', function(done){
      specHelper.apiTest.put('/api/user/1234?key=value', 0, {}, function(response, json){
        json.requesterInformation.receivedParams.action.should.equal('user')
        json.requesterInformation.receivedParams.userID.should.equal('1234')
        json.requesterInformation.receivedParams.key.should.equal('value')
        done();
      });
    });

    it('Routes should be mapped for DELETE', function(done){
      specHelper.apiTest.del('/api/user/1234?key=value', 0, {}, function(response, json){
        json.requesterInformation.receivedParams.action.should.equal('user')
        json.requesterInformation.receivedParams.userID.should.equal('1234')
        json.requesterInformation.receivedParams.key.should.equal('value')
        done();
      });
    });

    it('route params trump explicit params', function(done){
      specHelper.apiTest.get('/api/search/SearchTerm/limit/123/offset/456?term=otherSearchTerm&limit=0&offset=0', 0, {}, function(response, json){
        json.requesterInformation.receivedParams.action.should.equal('search')
        json.requesterInformation.receivedParams.term.should.equal('SearchTerm')
        json.requesterInformation.receivedParams.limit.should.equal(123)
        json.requesterInformation.receivedParams.offset.should.equal(456)
        done();
      });
    });

    it('regexp matches will provide proper variables', function(done){
      specHelper.apiTest.post('/api/login/123', 0, {}, function(response, json){
        json.requesterInformation.receivedParams.action.should.equal('login');
        json.requesterInformation.receivedParams.userID.should.equal('123');
        done();
      });
    });

    it('regexp matches will still work with params with periods and other wacky chars', function(done){
      specHelper.apiTest.get('/api/c/key/log_me-in.com$123.jpg', 0, {}, function(response, json){
        json.requesterInformation.receivedParams.action.should.equal('cacheTest');
        json.requesterInformation.receivedParams.value.should.equal('log_me-in.com$123.jpg');
        done();
      });
    });

    it('regexp match failures will be rejected', function(done){
      specHelper.apiTest.post('/api/login/1234', 0, {}, function(response, json){
        json.error.should.equal('Error: login is not a known action or that is not a valid apiVersion.');
        json.requesterInformation.receivedParams.action.should.equal('login');
        should.not.exist(json.requesterInformation.receivedParams.userID);
        done();
      });
    });

    describe('file extensions + routes', function(){

      it('will change header information based on extension (when active)', function(done){
        specHelper.apiTest.get('/api/mimeTestAction/val.png', 0, {}, function(response, json){
          response.headers['content-type'].should.equal('image/png');
          done();
        });
      });

      it('will not change header information if there is a connection.error', function(done){
        specHelper.apiTest.get('/api/mimeTestAction', 0, {}, function(response, json){
          response.headers['content-type'].should.equal('application/json');
          json.error.should.equal('Error: key is a required parameter for this action');
          done();
        });
      });

    });

  });

});
