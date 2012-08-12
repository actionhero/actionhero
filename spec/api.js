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
  "api.actions": {
    topic: function(){ return apiObj },
    'should exist: objects' : function(api){ 
      specHelper.assert.isObject(api.actions);
      specHelper.assert.isObject(api.actions.actionsView);
      specHelper.assert.isObject(api.actions.cacheTest);
      specHelper.assert.isObject(api.actions.file);
      specHelper.assert.isObject(api.actions.randomNumber);
      specHelper.assert.isObject(api.actions.status);
    },
    'should have details': function(api){
      specHelper.assert.equal(api.actions.randomNumber.name, "randomNumber");
      specHelper.assert.equal(api.actions.randomNumber.description, "I am an API method which will generate a random number.  Different HTTP verbs will multiply the answer");
      specHelper.assert.equal(api.actions.randomNumber.outputExample.randomNumber, 123);
    },
    'should have functions as run': function(api){
      specHelper.assert.isFunction(api.actions.actionsView.run);
      specHelper.assert.isFunction(api.actions.cacheTest.run);
      specHelper.assert.isFunction(api.actions.file.run);
      specHelper.assert.isFunction(api.actions.randomNumber.run);
      specHelper.assert.isFunction(api.actions.status.run);
    }
  }
});

suite.addBatch({
  "api.configData": {
    topic: function(){ return apiObj },
    'should exist: objects' : function(api){ specHelper.assert.isObject(api.configData); },
  }
});

suite.addBatch({
  "api.stats": {
    topic: function(){ return apiObj },
    'should exist: objects' : function(api){ specHelper.assert.isObject(api.stats); },
  }
});

suite.addBatch({
  "api.postVariables": {
    topic: function(){ return apiObj },
    'should exist: objects' : function(api){ specHelper.assert.isArray(api.postVariables); },
    'should have defaults included': function(api){
      var required = [
        "callback",
        "action",
        "limit",
        "offset",
        "outputType"
      ];
      for (var i in required){
        specHelper.assert.isTrue(api.postVariables.indexOf(required[i]) > -1);
      }
    },
    "should have params from actions too" : function(api){ 
      specHelper.assert.isTrue(api.postVariables.indexOf("key") > -1);
      specHelper.assert.isTrue(api.postVariables.indexOf("value") > -1);
    }
  }
});

// export
suite.export(module);