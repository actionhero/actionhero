describe('Server: Web', function(){

  var specHelper = require(__dirname + '/_specHelper.js').specHelper;
  var apiObj = {};
  var rawApi = {};
  var should = require("should");

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
    specHelper.apiTest.get('', 0, {}, function(response, json){
      json.should.be.an.instanceOf(Object);
      done();
    });
  });

  it('Server basic response should be JSON and have basic data', function(done){
    specHelper.apiTest.get('', 0, {}, function(response, json){
      json.should.be.an.instanceOf(Object);
      json.requestorInformation.should.be.an.instanceOf(Object);
      done();
    });
  });

  it('But I can get XML if I want', function(done){
    specHelper.apiTest.get('', 0, {outputType: "xml"}, function(response, json){
      response.body.should.be.a('string');
      response.body.should.include('<?xml version="1.0" encoding="utf-8"?>');
      response.body.should.include('<XML>');
      response.body.should.include('<error>Error: {no action} is not a known action or that is not a valid apiVersion.</error>');
      response.body.should.include('<apiVersion>'+apiObj.configData.general.apiVersion+'</apiVersion>');
      done();
    });
  });

  it('params work', function(done){
    specHelper.apiTest.get('/testAction/', 0, {}, function(response, json){
      json.requestorInformation.receivedParams.action.should.equal('testAction')
      done();
    });
  });

  it('params are ignored unless they are in the whitelist', function(done){
    specHelper.apiTest.get('/testAction/?crazyParam123=something', 0, {}, function(response, json){
      json.requestorInformation.receivedParams.action.should.equal('testAction');
      should.not.exist(json.requestorInformation.receivedParams['crazyParam123']);
      done();
    });
  });

  it('limit and offset should have defaults', function(done){
    specHelper.apiTest.get('/', 0, {}, function(response, json){
      json.requestorInformation.receivedParams.limit.should.equal(100)
      json.requestorInformation.receivedParams.offset.should.equal(0)
      done();
    });
  });

  it('gibberish actions have the right response', function(done){
    specHelper.apiTest.get('/IAMNOTANACTION', 0, {}, function(response, json){
      json.error.should.equal('Error: IAMNOTANACTION is not a known action or that is not a valid apiVersion.')
      done();
    });
  });

  it('real actions do not have an error response', function(done){
    specHelper.apiTest.get('/status', 0, {}, function(response, json){
      // response.body.error.should.equal('OK')
      should.not.exist(json.error);
      done();
    });
  });

  it('HTTP Verbs should work: GET', function(done){
    specHelper.apiTest.get('/randomNumber', 0, {}, function(response, json){
      json.randomNumber.should.be.within(0,1)
      done();
    });
  });

  it('HTTP Verbs should work: PUT', function(done){
    specHelper.apiTest.put('/randomNumber', 0, {}, function(response, json){
      json.randomNumber.should.be.within(0,10)
      done();
    });
  });

  it('HTTP Verbs should work: POST', function(done){
    specHelper.apiTest.post('/randomNumber', 0, {}, function(response, json){
      json.randomNumber.should.be.within(0,100)
      done();
    });
  });

  it('HTTP Verbs should work: DELETE', function(done){
    specHelper.apiTest.del('/randomNumber', 0, {}, function(response, json){
      json.randomNumber.should.be.within(0,1000)
      done();
    });
  });

  it('HTTP Verbs should work: Post with Form', function(done){
    var postURL = 'http://' + specHelper.url + ":" + specHelper.params[0].servers.web.port + "/api/cacheTest";
    specHelper.request.post(postURL, {form: {key:'key', value: 'value'}}, function(err, response, body){
      body = JSON.parse(body);
      body.cacheTestResults.saveResp.should.eql(true);
      done();
    });
  });

  it('returnErrorCodes false should still have a status of 200', function(done){
    specHelper.apiTest.del('/', 0, {}, function(response, json){
      response.statusCode.should.eql(200);
      done();
    });
  });

  describe('http header', function(){

    before(function(done){
      rawApi.configData.servers.web.returnErrorCodes = true;
      rawApi.actions.versions.headerTestAction = [1]
      rawApi.actions.actions.headerTestAction = {
        "1": {
          name: "headerTestAction",
          description: "I am a test",
          version: 1,
          inputs: { required: [], optional: [] }, outputExample: {},
          run:function(api, connection, next){
            connection.rawConnection.responseHeaders.push(['thing', "A"]);
            connection.rawConnection.responseHeaders.push(['thing', "B"]);
            connection.rawConnection.responseHeaders.push(['thing', "C"]);
            connection.rawConnection.responseHeaders.push(['set-cookie', "value 1"]);
            connection.rawConnection.responseHeaders.push(['set-cookie', "value 2"]);
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
      specHelper.apiTest.del('/headerTestAction', 0, {}, function(response, json){
        response.statusCode.should.eql(200);
        response.headers['thing'].should.eql("C");
        done();
      });
    });

    it('but duplicate set-cookie requests should be allowed', function(done){
      specHelper.apiTest.del('/headerTestAction', 0, {}, function(response, json){
        response.statusCode.should.eql(200);
        response.headers['set-cookie'].length.should.eql(2);
        response.headers['set-cookie'][1].should.eql('value 1');
        response.headers['set-cookie'][0].should.eql('value 2');
        done();
      });
    });

  });

  describe('http returnErrorCodes true', function(){

    before(function(done){
      rawApi.configData.servers.web.returnErrorCodes = true;
      rawApi.actions.versions.statusTestAction = [1]
      rawApi.actions.actions.statusTestAction = {
        "1": {
          name: "statusTestAction",
          description: "I am a test",
          inputs: { required: ["key"], optional: [] }, outputExample: {},
          run:function(api, connection, next){
            if(connection.params.key != 'value'){
              connection.error = "key != value";
              connection.rawConnection.responseHttpCode = 402;
            }else{
              connection.response.good = true;
            }
            next(connection, true);
          }
        }
      }
      done();
    });

    after(function(done){
      rawApi.configData.servers.web.returnErrorCodes = false;
      delete rawApi.actions.versions['statusTestAction'];
      delete rawApi.actions.actions['statusTestAction'];
      done();
    });

    it('actions that do not exists should return 404', function(done){
      specHelper.apiTest.del('/aFakeAction', 0, {}, function(response, json){
        response.statusCode.should.eql(404);
        done();
      });
    });

    it('missing params result in a 422', function(done){
      specHelper.apiTest.del('/statusTestAction', 0, {}, function(response, json){
        response.statusCode.should.eql(422);
        done();
      });
    });

    it('status codes can be set for errors', function(done){
      specHelper.apiTest.del('/statusTestAction', 0, {key: 'bannana'}, function(response, json){
        json.error.should.eql('key != value');
        response.statusCode.should.eql(402);
        done();
      });
    });

    it('status code should still be 200 if everything is OK', function(done){
      specHelper.apiTest.del('/statusTestAction', 0, {key: 'value'}, function(response, json){
        json.good.should.eql(true);
        response.statusCode.should.eql(200);
        done();
      });
    });

  });

  describe('routes', function(){
    
    beforeEach(function(done){
      rawApi.routes.loadRoutes({
        all: [
          { path: "/user/:userID", action: "user" }
        ],
        get: [
          { path: "/users", action: "usersList" },
          { path: "/search/:term/limit/:limit/offset/:offset", action: "search" },
        ],
        post: [
          { path: "/login/:userID(^\\d{3}$)", action: "login" }
        ]
      });

      done();
    });

    afterEach(function(done){
      rawApi.routes.routes = {};
      done();
    });

    it('new params will be allowed in route definitions', function(done){
      rawApi.params.postVariables.should.include("userID");
      done();
    });

    it('"all" routes are duplicated properly', function(done){
      ["get", "post", "put", "delete"].forEach(function(verb){
        rawApi.routes.routes[verb][0].action.should.equal("user");
        rawApi.routes.routes[verb][0].path.should.equal("/user/:userID");
      });
      done();
    })
  
    it('unknwon actions are still unknwon', function(done){
      specHelper.apiTest.get('/a_crazy_action', 0, {}, function(response, json){
        json.requestorInformation.receivedParams.action.should.equal('a_crazy_action')
        json.error.should.equal('Error: a_crazy_action is not a known action or that is not a valid apiVersion.')
        done();
      });
    });

    it('explicit action declarations still override routed actions, if the defined action is real', function(done){
      specHelper.apiTest.get('/user/123?action=randomNumber', 0, {}, function(response, json){
        json.requestorInformation.receivedParams.action.should.equal('randomNumber')
        done();
      });
    });

    it('route actions will override explicit actions, if the defined action is null', function(done){
      specHelper.apiTest.get('/user/123?action=someFakeAction', 0, {}, function(response, json){
        json.requestorInformation.receivedParams.action.should.equal('user')
        done();
      });
    });

    it('Routes should be mapped for GET (simple)', function(done){
      specHelper.apiTest.get('/users', 0, {}, function(response, json){
        json.requestorInformation.receivedParams.action.should.equal('usersList')
        done();
      });
    });

    it('Routes should be mapped for GET (complex)', function(done){
      specHelper.apiTest.get('/user/1234', 0, {}, function(response, json){
        json.requestorInformation.receivedParams.action.should.equal('user')
        json.requestorInformation.receivedParams.userID.should.equal('1234')
        done();
      });
    });

    it('Routes should be mapped for POST', function(done){
      specHelper.apiTest.post('/user/1234?key=value', 0, {}, function(response, json){
        json.requestorInformation.receivedParams.action.should.equal('user')
        json.requestorInformation.receivedParams.userID.should.equal('1234')
        json.requestorInformation.receivedParams.key.should.equal('value')
        done();
      });
    });

    it('Routes should be mapped for PUT', function(done){
      specHelper.apiTest.put('/user/1234?key=value', 0, {}, function(response, json){
        json.requestorInformation.receivedParams.action.should.equal('user')
        json.requestorInformation.receivedParams.userID.should.equal('1234')
        json.requestorInformation.receivedParams.key.should.equal('value')
        done();
      });
    });

    it('Routes should be mapped for DELETE', function(done){
      specHelper.apiTest.del('/user/1234?key=value', 0, {}, function(response, json){
        json.requestorInformation.receivedParams.action.should.equal('user')
        json.requestorInformation.receivedParams.userID.should.equal('1234')
        json.requestorInformation.receivedParams.key.should.equal('value')
        done();
      });
    });

    it('route params trump explicit params', function(done){
      specHelper.apiTest.get('/search/SeachTerm/limit/123/offset/456?term=otherSearchTerm&limit=0&offset=0', 0, {}, function(response, json){
        json.requestorInformation.receivedParams.action.should.equal('search')
        json.requestorInformation.receivedParams.term.should.equal('SeachTerm')
        json.requestorInformation.receivedParams.limit.should.equal(123)
        json.requestorInformation.receivedParams.offset.should.equal(456)
        done();
      });
    });

    it('regexp matches will provide proper variables', function(done){
      specHelper.apiTest.post('/login/123', 0, {}, function(response, json){
        json.requestorInformation.receivedParams.action.should.equal('login');
        json.requestorInformation.receivedParams.userID.should.equal('123');
        done();
      });
    });

    it('regexp match failures will be rejected', function(done){
      specHelper.apiTest.post('/login/1234', 0, {}, function(response, json){
        json.error.should.equal("Error: login is not a known action or that is not a valid apiVersion.");
        json.requestorInformation.receivedParams.action.should.equal('login');
        should.not.exist(json.requestorInformation.receivedParams.userID);
        done();
      });
    });

  });

});