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
})

// export
suite.export(module);