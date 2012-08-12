var specHelper = require('../helpers/_specHelper.js').specHelper;
var suite = specHelper.vows.describe('action: cacheTest');
var apiObj = {};

var actionUrl = "/cacheTest/";

suite.addBatch({
  'specHelper.prepare':{
    topic: function(){ var cb = this.callback; specHelper.prepare(0, function(api){ apiObj = specHelper.cleanAPIObject(api); cb(); }) },
    'api object should exist': function(){ specHelper.assert.isObject(apiObj); } }
});

suite.addBatch({
  "cacheTest: no params": {
    topic: function(){ specHelper.apiTest.get(actionUrl, 0, {} ,this.callback ); },
    error: function(res, b){ specHelper.assert.equal(res.body.error, "key is a required parameter for this action"); },
  },
  "cacheTest: just key ": {
    topic: function(){ specHelper.apiTest.get(actionUrl, 0, {key: "test key"} ,this.callback ); },
    error: function(res, b){ specHelper.assert.equal(res.body.error, "value is a required parameter for this action"); },
  },
  "cacheTest: just value ": {
    topic: function(){ specHelper.apiTest.get(actionUrl, 0, {value: "abc123"} ,this.callback ); },
    error: function(res, b){ specHelper.assert.equal(res.body.error, "key is a required parameter for this action"); },
  },
  "cacheTest: gibberish param ": {
    topic: function(){ specHelper.apiTest.get(actionUrl, 0, {thingy: "abc123"} ,this.callback ); },
    error: function(res, b){ specHelper.assert.equal(res.body.error, "key is a required parameter for this action"); },
  },
  "correct params ": {
    topic: function(){ specHelper.apiTest.get(actionUrl, 0, {key: "testKey", value: "abc123"} ,this.callback ); },
    error: function(res, b){ specHelper.assert.equal(res.body.error, "OK"); },
    params: function(res, b){ 
      specHelper.assert.equal(res.body.cacheTestResults.saveResp, true); 
      specHelper.assert.equal(res.body.cacheTestResults.loadResp.value, "abc123"); 
      specHelper.assert.equal(res.body.cacheTestResults.deleteResp, true); 
    },
  }
});

// export
suite.export(module);