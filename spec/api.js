var specHelper = require('../specHelper.js').specHelper;
var suite = specHelper.vows.describe('API general functions');
var apiObj = {};

suite.addBatch({
  'specHelper.prepare':{
    topic: function(){
      var cb = this.callback;
      specHelper.prepare(function(api){
        apiObj = specHelper.cleanAPIObject(api);
        cb();
      })
    },
    'api object should exist': function(){ specHelper.assert.isObject(apiObj); },
    'api object should have actions': function(){ specHelper.assert.isObject(apiObj.actions); },
    'api object should have tasks': function(){ specHelper.assert.isObject(apiObj.tasks); },
    'api object should have utils': function(){ specHelper.assert.isObject(apiObj.utils); },
  }
});

suite.addBatch({
  "Server should be up and return data": {
    topic: function(){ specHelper.apiTest.get('', {} ,this.callback ); },
    '/ should repond something' : function(res, b){ specHelper.assert.ok(res.body); }
  }
});

suite.addBatch({
  "Server basic response should be JSON and have basic data": {
    topic: function(){ specHelper.apiTest.get('/', {} ,this.callback ); },
    'should be JSON' : function(res, b){ specHelper.assert.isObject(res.body); },
    'requestorInformation' : function(res, b){ specHelper.assert.isObject(res.body.requestorInformation); },
  },

  "params work": {
    topic: function(){ specHelper.apiTest.get('/testAction/', {},this.callback ); },
    'limit' : function(res, b){ specHelper.assert.equal(res.body.requestorInformation.recievedParams.action, "testAction"); },
  },

  "params are ignored unless they are in the whitelist": {
    topic: function(){ specHelper.apiTest.get('/testAction/?crazyParam123=something', {},this.callback ); },
    'limit' : function(res, b){ specHelper.assert.equal(res.body.requestorInformation.recievedParams.action, "testAction"); },
    'limit' : function(res, b){ specHelper.assert.equal(res.body.requestorInformation.recievedParams.crazyParam123, null); },
  },

  "limit and offset should have defaults": {
    topic: function(){ specHelper.apiTest.get('/', {} ,this.callback ); },
    'limit' : function(res, b){ specHelper.assert.equal(res.body.requestorInformation.recievedParams.limit, 100); },
    'offset' : function(res, b){ specHelper.assert.equal(res.body.requestorInformation.recievedParams.offset, 0); },
  },

  "default error should make sense": {
    topic: function(){ specHelper.apiTest.get('/', {} ,this.callback ); },
    'error' : function(res, b){ specHelper.assert.equal(res.body.error, "{no action} is not a known action."); },
  }
});

var reqLimit = 0;
suite.addBatch({
  "Making requests should decrement your api requset limit": {
    topic: function(){ specHelper.apiTest.get('', {} ,this.callback ); },
    'user should have request limit' : function(res, b){ 
      reqLimit = res.body.requestorInformation.RequestsRemaining;
      specHelper.assert.isTrue(reqLimit > 0); 
    }
  }
}).addBatch({
  "updates should decrease your limit": {
    topic: function(){ specHelper.apiTest.get('', {} ,this.callback ); },
    'decrease' : function(res, b){ 
      specHelper.assert.isTrue(res.body.requestorInformation.RequestsRemaining < reqLimit); 
    }
  },
});

suite.addBatch({
  "gibberish actions have the right response": {
    topic: function(){ specHelper.apiTest.get('/IAMNOTANACTION', {} ,this.callback ); },
    'error' : function(res, b){ specHelper.assert.equal(res.body.error, "IAMNOTANACTION is not a known action."); },
  }
});

suite.addBatch({
  "real actions respons with OK": {
    topic: function(){ specHelper.apiTest.get('/actionsView', {} ,this.callback ); },
    'error' : function(res, b){ specHelper.assert.equal(res.body.error, "OK"); },
  }
});

// export
suite.export(module);