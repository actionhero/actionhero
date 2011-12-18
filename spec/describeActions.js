var specHelper = require('../specHelper.js').specHelper;
var suite = specHelper.vows.describe('API general function');
var apiObj = {};

suite.addBatch({
  'specHelper.prepare':{
    topic: function(){
      var cb = this.callback;
      specHelper.prepare(function(api){ apiObj = specHelper.cleanAPIObject(api); cb(); })
    },
    'api object should exist': function(){ specHelper.assert.isObject(apiObj); } }
});

// export
suite.export(module);