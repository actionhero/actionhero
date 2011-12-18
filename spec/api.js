var specHelper = require('../specHelper.js').specHelper;
var suite = specHelper.vows.describe('API general function');
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

  "limit and offset should have defaults": {
    topic: function(){ specHelper.apiTest.get('/', {} ,this.callback ); },
    'limit' : function(res, b){ specHelper.assert.equal(100, res.body.requestorInformation.recievedParams.limit); },
    'offset' : function(res, b){ specHelper.assert.equal(0, res.body.requestorInformation.recievedParams.offset); },
  },

  "default error should make sense": {
    topic: function(){ specHelper.apiTest.get('/', {} ,this.callback ); },
    'limit' : function(res, b){ specHelper.assert.equal("{no action} is not a known action.", res.body.error); },
  }
});

// export
suite.export(module);