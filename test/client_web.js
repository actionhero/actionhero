describe('Client: Web', function(){
    var specHelper = require('../helpers/_specHelper.js').specHelper;
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

    it('utils.mapParamsFromURL: action in url', function(done){
    	var connection = {
		    action: "checkGame",
		    parsedURL: {
		        path: "/checkGame/game-10/user-13/something_else"
		    }
		}
		var map = ["gameID", "userID", "data"]
		var urlParams = apiObj.utils.mapParamsFromURL(connection, map);
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
		var urlParams = apiObj.utils.mapParamsFromURL(connection, map);
		urlParams.gameID.should.equal('game-10')
		urlParams.userID.should.equal('user-13')
		urlParams.data.should.equal('something_else')
		done()
    });

    describe('routes', function(){
		beforeEach(function(done){
				rawApi.routes = {
			    users: {
			      get: {
			        action: "usersList", // (GET) /api/users
			      }
			    },
			    user : {
			      get: {
			        action: "userAdd",
			        urlMap: ["userID"], // (GET) /api/user/123
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
			rawApi.routes.should.be.an.instanceOf(Object);
			rawApi.routes.users.should.be.an.instanceOf(Object);
			rawApi.routes.user.should.be.an.instanceOf(Object);
			done();
		});

		afterEach(function(done){
			rawApi.routes = {};
			rawApi.routes.should.be.an.instanceOf(Object);
			should.not.exist(rawApi.routes.users);
			should.not.exist(rawApi.routes.user);
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