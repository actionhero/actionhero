var specHelper = require('../specHelper.js').specHelper;
var suite = specHelper.vows.describe('action: status');
var apiObj = {};

var actionUrl = "/status/";

suite.addBatch({
  'specHelper.prepare':{
    topic: function(){ var cb = this.callback; specHelper.prepare(function(api){ apiObj = specHelper.cleanAPIObject(api); cb(); }) },
    'api object should exist': function(){ specHelper.assert.isObject(apiObj); } }
});

suite.addBatch({
  "status: error": {
    topic: function(){ specHelper.apiTest.get(actionUrl, {} ,this.callback ); },
    error: function(res, b){ specHelper.assert.equal(res.body.error, "OK");},
  },
  "status: stats": {
    topic: function(){ specHelper.apiTest.get(actionUrl, {} ,this.callback ); },
    stats: function(res, b){ 
      specHelper.assert.isTrue(res.body.stats.numberOfWebRequests > 0);
      specHelper.assert.isTrue(res.body.stats.numberOfSocketRequests >= 0);
      specHelper.assert.isTrue(res.body.stats.startTime > 0);
      specHelper.assert.isTrue(res.body.stats.uptime > 0);
    },
  },

});

// export
suite.export(module);