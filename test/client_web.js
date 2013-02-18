describe('Client: Web', function(){
    var specHelper = require('../helpers/specHelper.js').specHelper;
    var apiObj = {};
    var rawApi = {};
    var should = require("should");

    before(function(done){
        specHelper.prepare(0, function(api){ 
          rawApi = api;
            apiObj = specHelper.cleanAPIObject(api);
            specHelper.resetCookieJar();
            done();
        })
    });

    it('Server should be up and return data', function(done){
      specHelper.apiTest.get('', 0, {}, function(response){
        response.body.should.be.an.instanceOf(Object);
        done();
      });
    });

    it('Server basic response should be JSON and have basic data', function(done){
      specHelper.apiTest.get('', 0, {}, function(response){
        response.body.should.be.an.instanceOf(Object);
        response.body.requestorInformation.should.be.an.instanceOf(Object);
        done();
      });
    });

    it('But I can get XML if I want', function(done){
      specHelper.apiTest.get('', 0, {outputType: "xml"}, function(response){
        response.body.should.be.a('string');
        response.body.should.include('<?xml version="1.0" encoding="utf-8"?>');
        response.body.should.include('<XML>');
        response.body.should.include('<error>Error: {no action} is not a known action.</error>');
        response.body.should.include('<apiVersion>'+apiObj.configData.general.apiVersion+'</apiVersion>');
        done();
      });
    });

    it('params work', function(done){
      specHelper.apiTest.get('/testAction/', 0, {}, function(response){
        response.body.requestorInformation.receivedParams.action.should.equal('testAction')
        done();
      });
    });

  it('params are ignored unless they are in the whitelist', function(done){
      specHelper.apiTest.get('/testAction/?crazyParam123=something', 0, {}, function(response){
        response.body.requestorInformation.receivedParams.action.should.equal('testAction');
        should.not.exist(response.body.requestorInformation.receivedParams['crazyParam123']);
        done();
      });
    });

    it('limit and offset should have defaults', function(done){
      specHelper.apiTest.get('/', 0, {}, function(response){
        response.body.requestorInformation.receivedParams.limit.should.equal(100)
        response.body.requestorInformation.receivedParams.offset.should.equal(0)
        done();
      });
    });

    it('gibberish actions have the right response', function(done){
      specHelper.apiTest.get('/IAMNOTANACTION', 0, {}, function(response){
        response.body.error.should.equal('Error: IAMNOTANACTION is not a known action.')
        done();
      });
    });

    it('real actions do not have an error response', function(done){
      specHelper.apiTest.get('/actionsView', 0, {}, function(response){
        // response.body.error.should.equal('OK')
        should.not.exist(response.body.error);
        done();
      });
    });

    it('HTTP Verbs should work: GET', function(done){
      specHelper.apiTest.get('/randomNumber', 0, {}, function(response){
        response.body.randomNumber.should.be.within(0,1)
        done();
      });
    });

    it('HTTP Verbs should work: PUT', function(done){
      specHelper.apiTest.put('/randomNumber', 0, {}, function(response){
        response.body.randomNumber.should.be.within(0,10)
        done();
      });
    });

    it('HTTP Verbs should work: POST', function(done){
      specHelper.apiTest.post('/randomNumber', 0, {}, function(response){
        response.body.randomNumber.should.be.within(0,100)
        done();
      });
    });

    it('HTTP Verbs should work: DELETE', function(done){
      specHelper.apiTest.del('/randomNumber', 0, {}, function(response){
        response.body.randomNumber.should.be.within(0,1000)
        done();
      });
    });

    it('HTTP Verbs should work: Post with Form', function(done){
      var postURL = 'http://' + specHelper.url + ":" + specHelper.params[0].httpServer.port + "/api/cacheTest";
      specHelper.request.post(postURL, {form: {key:'key', value: 'value'}}, function(err, response, body){
        body = JSON.parse(body);
        body.cacheTestResults.saveResp.should.eql(true);
        done();
      });
    });

    it('returnErrorCodes false should still have a status of 200', function(done){
      specHelper.apiTest.del('/', 0, {}, function(response){
        response.statusCode.should.eql(200);
        done();
      });
    });

    describe('http header', function(){

      before(function(done){
        rawApi.configData.commonWeb.returnErrorCodes = true;
        rawApi.actions.actions.headerTestAction = {
          name: "headerTestAction",
          description: "I am a test",
          inputs: { required: [], optional: [] }, outputExample: {},
          run:function(api, connection, next){
            connection.responseHeaders.push(['thing', "A"]);
          connection.responseHeaders.push(['thing', "B"]);
          connection.responseHeaders.push(['thing', "C"]);
          connection.responseHeaders.push(['set-cookie', "value 1"]);
          connection.responseHeaders.push(['set-cookie', "value 2"]);
            next(connection, true);
          }
        }
        done();
      });

      it('duplicate cookies should be removed (in favor of the last set)', function(done){
        specHelper.apiTest.del('/headerTestAction', 0, {}, function(response){
          response.statusCode.should.eql(200);
          response.headers['thing'].should.eql("C");
          done();
        });
      });

      it('but duplicate set-cookie requests should be allowed', function(done){
        specHelper.apiTest.del('/headerTestAction', 0, {}, function(response){
          response.statusCode.should.eql(200);
          response.headers['set-cookie'].length.should.eql(2);
          response.headers['set-cookie'][1].should.eql('value 1');
          response.headers['set-cookie'][0].should.eql('value 2');
          done();
        });
      });

      after(function(done){
        delete rawApi.actions.actions['headerTestAction'];
        done();
      })

    });

    describe('http returnErrorCodes true', function(){

      before(function(done){
        rawApi.configData.commonWeb.returnErrorCodes = true;
        rawApi.actions.actions.statusTestAction = {
          name: "statusTestAction",
          description: "I am a test",
          inputs: { required: ["key"], optional: [] }, outputExample: {},
          run:function(api, connection, next){
            if(connection.params.key != 'value'){
              connection.error = "key != value";
              connection.responseHttpCode = 402;
            }else{
              connection.response.good = true;
            }
            next(connection, true);
          }
        }
        done();
      })

      it('actions that do not exists should return 404', function(done){
        specHelper.apiTest.del('/aFakeAction', 0, {}, function(response){
          response.statusCode.should.eql(404);
          done();
        });
      });

      it('missing params result in a 422', function(done){
        specHelper.apiTest.del('/statusTestAction', 0, {}, function(response){
          response.statusCode.should.eql(422);
          done();
        });
      });

      it('status codes can be set for errrors', function(done){
        specHelper.apiTest.del('/statusTestAction', 0, {key: 'bannana'}, function(response){
          response.body.error.should.eql('key != value');
          response.statusCode.should.eql(402);
          done();
        });
      });

      it('status code should still be 200 if everything is OK', function(done){
        specHelper.apiTest.del('/statusTestAction', 0, {key: 'value'}, function(response){
          response.body.good.should.eql(true);
          response.statusCode.should.eql(200);
          done();
        });
      });

      after(function(done){
        rawApi.configData.commonWeb.returnErrorCodes = false;
        delete rawApi.actions.actions['statusTestAction'];
        done();
      })

    });

    it('utils.mapParamsFromURL: action in url', function(done){
      var connection = {
        action: "checkGame",
        parsedURL: {
            path: "/checkGame/game-10/user-13/something_else"
        }
    }
    var map = ["gameID", "userID", "data"]
    var urlParams = apiObj.params.mapParamsFromURL(connection, map);
    urlParams.gameID.should.equal('game-10')
    urlParams.userID.should.equal('user-13')
    urlParams.data.should.equal('something_else')
    done()
    });

    it('utils.mapParamsFromURL: action in url', function(done){
      var connection = {
        action: "checkGame",
        parsedURL: {
            path: "/game-10/user-13/something_else"
        }
    }
    var map = ["gameID", "userID", "data"]
    var urlParams = apiObj.params.mapParamsFromURL(connection, map);
    urlParams.gameID.should.equal('game-10')
    urlParams.userID.should.equal('user-13')
    urlParams.data.should.equal('something_else')
    done()
    });

    describe('routes', function(){
    beforeEach(function(done){
        rawApi.routes.routes = {
          users: {
            get: {
              action: "usersList" // (GET) /api/users
            }
          },
          user : {
            get: {
              action: "userAdd",
              urlMap: ["userID"] // (GET) /api/user/123
            },
            post: {
              action: "userEdit",
              urlMap: ["userID"] // (POST) /api/user/123
            },
            put: {
              action: "userAdd",
              urlMap: ["type", "screenName", "key", "value"] // (PUT) /api/user/admin/handle123
            },
            delete: {
              action: "userDelete",
              urlMap: ["userID"] // (DELETE) /api/user/123
            }
          }
      };
      rawApi.routes.routes.should.be.an.instanceOf(Object);
      rawApi.routes.routes.users.should.be.an.instanceOf(Object);
      rawApi.routes.routes.user.should.be.an.instanceOf(Object);
      done();
    });

    afterEach(function(done){
      rawApi.routes.routes = {};
      rawApi.routes.routes.should.be.an.instanceOf(Object);
      should.not.exist(rawApi.routes.routes.users);
      should.not.exist(rawApi.routes.routes.user);
      done();
    });
    
      it('unknwon actions are still unknwon', function(done){
        specHelper.apiTest.get('/a_crazy_action', 0, {}, function(response){
          response.body.requestorInformation.receivedParams.action.should.equal('a_crazy_action')
          response.body.error.should.equal('Error: a_crazy_action is not a known action.')
          done();
        });
      });

      it('explicit action declarations still override routed actions', function(done){
        specHelper.apiTest.get('/user/123?action=theRealAction', 0, {}, function(response){
          response.body.requestorInformation.receivedParams.action.should.equal('theRealAction')
          response.body.error.should.equal('Error: theRealAction is not a known action.')
          done();
        });
      });

      it('Routes should be mapped for GET (simple)', function(done){
        specHelper.apiTest.get('/users', 0, {}, function(response){
          response.body.requestorInformation.receivedParams.action.should.equal('usersList')
          done();
        });
      });

      it('Routes should be mapped for GET (complex)', function(done){
        specHelper.apiTest.get('/user/1234', 0, {}, function(response){
          response.body.requestorInformation.receivedParams.action.should.equal('userAdd')
          response.body.requestorInformation.receivedParams.userID.should.equal('1234')
          done();
        });
      });

      it('Routes should be mapped for POST', function(done){
        specHelper.apiTest.post('/user/1234?key=value', 0, {}, function(response){
          response.body.requestorInformation.receivedParams.action.should.equal('userEdit')
          response.body.requestorInformation.receivedParams.userID.should.equal('1234')
          response.body.requestorInformation.receivedParams.key.should.equal('value')
          done();
        });
      });

      it('Routes should be mapped for PUT', function(done){
        specHelper.apiTest.put('/user/theType/theScreenName', 0, {}, function(response){
          response.body.requestorInformation.receivedParams.action.should.equal('userAdd')
          response.body.requestorInformation.receivedParams.type.should.equal('theType')
          response.body.requestorInformation.receivedParams.screenName.should.equal('theScreenName')
          done();
        });
      });

      it('Routes should be mapped for DELETE', function(done){
        specHelper.apiTest.del('/user/1234', 0, {}, function(response){
          response.body.requestorInformation.receivedParams.action.should.equal('userDelete')
          response.body.requestorInformation.receivedParams.userID.should.equal('1234')
          done();
        });
      });

      it('explicit params win over route params', function(done){
        specHelper.apiTest.put('/user/theType/theScreenName/badKey?key=goodKey', 0, {}, function(response){
          response.body.requestorInformation.receivedParams.action.should.equal('userAdd')
          response.body.requestorInformation.receivedParams.type.should.equal('theType')
          response.body.requestorInformation.receivedParams.screenName.should.equal('theScreenName')
          response.body.requestorInformation.receivedParams.key.should.equal('goodKey')
          done();
        });
      });

  });

});