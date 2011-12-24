var specHelper = require('../_specHelper.js').specHelper;
var suite = specHelper.vows.describe('action: cacheTest');
var apiObj = {};

var actionUrl = "/cacheTest/";

suite.addBatch({
  'specHelper.prepare':{
    topic: function(){ var cb = this.callback; specHelper.prepare(function(api){ apiObj = specHelper.cleanAPIObject(api); cb(); }) },
    'api object should exist': function(){ specHelper.assert.isObject(apiObj); } }
});

suite.addBatch({
  "cacheTest: no params": {
    topic: function(){ specHelper.apiTest.get(actionUrl, {} ,this.callback ); },
    error: function(res, b){ specHelper.assert.equal(res.body.error, "key is a required parameter for this action"); },
  },
  "cacheTest: just key ": {
    topic: function(){ specHelper.apiTest.get(actionUrl, {key: "test key"} ,this.callback ); },
    error: function(res, b){ specHelper.assert.equal(res.body.error, "value is a required parameter for this action"); },
  },
  "cacheTest: just value ": {
    topic: function(){ specHelper.apiTest.get(actionUrl, {value: "abc123"} ,this.callback ); },
    error: function(res, b){ specHelper.assert.equal(res.body.error, "key is a required parameter for this action"); },
  },
  "cacheTest: gibberish param ": {
    topic: function(){ specHelper.apiTest.get(actionUrl, {thingy: "abc123"} ,this.callback ); },
    error: function(res, b){ specHelper.assert.equal(res.body.error, "key is a required parameter for this action"); },
  },
  "correct params ": {
    topic: function(){ specHelper.apiTest.get(actionUrl, {key: "testKey", value: "abc123"} ,this.callback ); },
    error: function(res, b){ specHelper.assert.equal(res.body.error, "OK"); },
    params: function(res, b){ 
      specHelper.assert.equal(res.body.cacheTestResults.key, "testKey"); 
      specHelper.assert.equal(res.body.cacheTestResults.value, "abc123"); 
      specHelper.assert.equal(res.body.cacheTestResults.saveResp, "new record"); 
      specHelper.assert.equal(res.body.cacheTestResults.loadResp, "abc123"); 
      specHelper.assert.equal(res.body.cacheTestResults.deleteResp, true); 
    },
  }
});

// export
suite.export(module);