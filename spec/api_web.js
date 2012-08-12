var specHelper = require('../helpers/_specHelper.js').specHelper;
var suite = specHelper.vows.describe('API general functions');
var apiObj = {};

suite.addBatch({
  'specHelper.prepare':{
    topic: function(){
      var cb = this.callback;
      specHelper.prepare(0, function(api){
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

// export
suite.export(module);