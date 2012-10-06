var specHelper = require('../helpers/_specHelper.js').specHelper;
var suite = specHelper.vows.describe('Web general functions');
var apiObj = {};
var rawApi = {};

suite.addBatch({
  'specHelper.prepare':{
    topic: function(){
      var cb = this.callback;
      specHelper.prepare(0, function(api){
        rawApi = api;
        apiObj = specHelper.cleanAPIObject(api);
        cb();
      })
    },
    'api object should exist': function(){ specHelper.assert.isObject(apiObj); },
  }
});

suite.addBatch({
  "Server should be up and return data": {
    topic: function(){ specHelper.apiTest.get('', 0, {} ,this.callback ); },
    '/ should repond something' : function(res, b){ specHelper.assert.ok(res.body); }
  }
});

suite.addBatch({
  "Server basic response should be JSON and have basic data": {
    topic: function(){ specHelper.apiTest.get('/', 0, {} ,this.callback ); },
    'should be JSON' : function(res, b){ specHelper.assert.isObject(res.body); },
    'requestorInformation' : function(res, b){ specHelper.assert.isObject(res.body.requestorInformation); },
  },

  "But I can get XML if I want": {
    topic: function(){ specHelper.apiTest.get('/', 0, {outputType: "xml"} ,this.callback ); },
    'should be XML' : function(res, b){ specHelper.assert.isString(res.body); },
    'has header' : function(res, b){ specHelper.assert.include(res.body, '<?xml version="1.0" encoding="utf-8"?>'); },
    'has base container' : function(res, b){ specHelper.assert.include(res.body, '<XML>'); },
    'has server info' : function(res, b){ specHelper.assert.include(res.body, '<apiVersion>3.0.11</apiVersion>'); },
    'has error' : function(res, b){ specHelper.assert.include(res.body, '<error>{no action} is not a known action.</error>'); },
  },

  "params work": {
    topic: function(){ specHelper.apiTest.get('/testAction/', 0, {},this.callback ); },
    'limit' : function(res, b){ specHelper.assert.equal(res.body.requestorInformation.recievedParams.action, "testAction"); },
  },

  "params are ignored unless they are in the whitelist": {
    topic: function(){ specHelper.apiTest.get('/testAction/?crazyParam123=something', 0, {},this.callback ); },
    'limit' : function(res, b){ specHelper.assert.equal(res.body.requestorInformation.recievedParams.action, "testAction"); },
    'limit' : function(res, b){ specHelper.assert.equal(res.body.requestorInformation.recievedParams.crazyParam123, null); },
  },

  "limit and offset should have defaults": {
    topic: function(){ specHelper.apiTest.get('/', 0, {} ,this.callback ); },
    'limit' : function(res, b){ specHelper.assert.equal(res.body.requestorInformation.recievedParams.limit, 100); },
    'offset' : function(res, b){ specHelper.assert.equal(res.body.requestorInformation.recievedParams.offset, 0); },
  },

  "default error should make sense": {
    topic: function(){ specHelper.apiTest.get('/', 0, {} ,this.callback ); },
    'error' : function(res, b){ specHelper.assert.equal(res.body.error, "{no action} is not a known action."); },
  }
});

suite.addBatch({
  "gibberish actions have the right response": {
    topic: function(){ specHelper.apiTest.get('/IAMNOTANACTION', 0, {} ,this.callback ); },
    'error' : function(res, b){ specHelper.assert.equal(res.body.error, "IAMNOTANACTION is not a known action."); },
  }
});

suite.addBatch({
  "real actions respons with OK": {
    topic: function(){ specHelper.apiTest.get('/actionsView', 0, {} ,this.callback ); },
    'error' : function(res, b){ specHelper.assert.equal(res.body.error, "OK"); },
  }
});

suite.addBatch({
  "HTTP Verbs should work: GET": {
    topic: function(){ specHelper.apiTest.get('/randomNumber', 0, {} ,this.callback ); },
    'bounds of response' : function(res, b){ 
      specHelper.assert.equal(res.body.randomNumber >= 0, true); 
      specHelper.assert.equal(res.body.randomNumber <= 1, true); 
    },
  }
});

suite.addBatch({
  "HTTP Verbs should work: PUT": {
    topic: function(){ specHelper.apiTest.put('/randomNumber', 0, {} ,this.callback ); },
    'bounds of response' : function(res, b){ 
      specHelper.assert.equal(res.body.randomNumber >= 0, true); 
      specHelper.assert.equal(res.body.randomNumber <= 10, true); 
    },
  }
});

suite.addBatch({
  "HTTP Verbs should work: POST": {
    topic: function(){ specHelper.apiTest.post('/randomNumber', 0, {} ,this.callback ); },
    'bounds of response' : function(res, b){ 
      specHelper.assert.equal(res.body.randomNumber >= 0, true); 
      specHelper.assert.equal(res.body.randomNumber <= 100, true); 
    },
  }
});

suite.addBatch({
  "HTTP Verbs should work: DELETE": {
    topic: function(){ specHelper.apiTest.del('/randomNumber', 0, {} ,this.callback ); },
    'bounds of response' : function(res, b){ 
      specHelper.assert.equal(res.body.randomNumber >= 0, true); 
      specHelper.assert.equal(res.body.randomNumber <= 1000, true); 
    },
  }
});

suite.addBatch({
   'utils.mapParamsFromURL: action in url': {
        topic: function(){ 
            connection = {
                action: "checkGamae",
                parsedURL: {
                    path: "/checkGamae/game-10/user-13/something_else"
                }
            }
            var map = ["gameID", "userID", "data"]
            var urlParams = apiObj.utils.mapParamsFromURL(connection, map)
            return(urlParams)
        },
        'it Should Work': function (urlParams) { 
            specHelper.assert.equal(urlParams.gameID, 'game-10'); 
            specHelper.assert.equal(urlParams.userID, 'user-13'); 
            specHelper.assert.equal(urlParams.data, 'something_else'); 
        },
    },
    'utils.mapParamsFromURL: action as GET variable': {
        topic: function(){ 
            connection = {
                action: "checkGamae",
                parsedURL: {
                    path: "/game-10/user-13/something_else"
                }
            }
            var map = ["gameID", "userID", "data"]
            var urlParams = apiObj.utils.mapParamsFromURL(connection, map)
            return(urlParams)
        },
        'it Should Work': function (urlParams) { 
            specHelper.assert.equal(urlParams.gameID, 'game-10'); 
            specHelper.assert.equal(urlParams.userID, 'user-13'); 
            specHelper.assert.equal(urlParams.data, 'something_else'); 
        },
    }
});

suite.addBatch({
  "I can overload routes": {
    topic: function(){ 
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
              urlMap: ["type", "screenName"] // (PUT) /api/user/admin/handle123
            },
            delete: {
              action: "userDelete",
              urlMap: ["userID"] // (DELETE) /api/user/123
            }
          }
        };
      this.callback(false, rawApi.routes); 
    },
    'yep, it\'s an object' : function(res, routes){ 
      specHelper.assert.isObject(routes); 
      specHelper.assert.isObject(routes.users); 
      specHelper.assert.isObject(routes.user); 
    },
  }
});

suite.addBatch({
  "unknwon actions are still unknwon": {
    topic: function(){ 
      specHelper.apiTest.get('/a_crazy_action', 0, {} ,this.callback ); 
    },
    'should work' : function(resp, b){
      specHelper.assert.equal(resp.body.requestorInformation.recievedParams.action, 'a_crazy_action');
      specHelper.assert.equal(resp.body.error, 'a_crazy_action is not a known action.');
    },
  },
  "explicit action declarations still override routed actions": {
    topic: function(){ 
      specHelper.apiTest.get('/user/123?action=theRealAction', 0, {} ,this.callback ); 
    },
    'should work' : function(resp, b){
      specHelper.assert.equal(resp.body.requestorInformation.recievedParams.action, 'theRealAction');
      specHelper.assert.equal(resp.body.error, 'theRealAction is not a known action.');
    },
  },
  "Routes should be mapped for GET (simple)": {
    topic: function(){ 
      specHelper.apiTest.get('/users', 0, {} ,this.callback ); 
    },
    'should work' : function(resp, b){ 
      var params = resp.body.requestorInformation.recievedParams;
      specHelper.assert.equal(params.action, 'usersList');
    },
  },
  "Routes should be mapped for GET (complex)": {
    topic: function(){ 
      specHelper.apiTest.get('/user/1234', 0, {} ,this.callback ); 
    },
    'should work' : function(resp, b){ 
      var params = resp.body.requestorInformation.recievedParams;
      specHelper.assert.equal(params.action, 'userAdd');
      specHelper.assert.equal(params.userID, '1234');
    },
  },
  "Routes should be mapped for POST": {
    topic: function(){ 
      specHelper.apiTest.post('/user/1234?key=value', 0, {} ,this.callback ); 
    },
    'should work' : function(resp, b){ 
      var params = resp.body.requestorInformation.recievedParams;
      specHelper.assert.equal(params.action, 'userEdit');
      specHelper.assert.equal(params.userID, '1234');
      specHelper.assert.equal(params.key, 'value');
    },
  },
  "Routes should be mapped for PUT": {
    topic: function(){ 
      specHelper.apiTest.put('/user/theType/theScreenName', 0, {} ,this.callback ); 
    },
    'should work' : function(resp, b){ 
      var params = resp.body.requestorInformation.recievedParams;
      specHelper.assert.equal(params.action, 'userAdd');
      specHelper.assert.equal(params.type, 'theType');
      specHelper.assert.equal(params.screenName, 'theScreenName');
    },
  },
  "Routes should be mapped for DELETE": {
    topic: function(){ 
      specHelper.apiTest.del('/user/1234', 0, {} ,this.callback ); 
    },
    'should work' : function(resp, b){ 
      var params = resp.body.requestorInformation.recievedParams;
      specHelper.assert.equal(params.action, 'userDelete');
      specHelper.assert.equal(params.userID, '1234');
    },
  },
});

suite.addBatch({
  "I can reset routes": {
    topic: function(){ 
      rawApi.routes = {};
      this.callback(falase, rawApi.routes);
    },
    'back to nothing' : function(res, b){ 
      specHelper.assert.equal(rawApi.routes.users, null); 
      specHelper.assert.equal(rawApi.routes.user, null); 
    },
  }
});

// export
suite.export(module);