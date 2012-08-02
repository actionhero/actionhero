var specHelper = require('../_specHelper.js').specHelper;
var suite = specHelper.vows.describe('action: file');
var apiObj = {};

var actionUrl = "/file/";

suite.addBatch({
  'specHelper.prepare':{
    topic: function(){ var cb = this.callback; specHelper.prepare(0, function(api){ apiObj = specHelper.cleanAPIObject(api); cb(); }) },
    'api object should exist': function(){ specHelper.assert.isObject(apiObj); } }
});

suite.addBatch({
  "file: response is NOT json": {
    topic: function(){ specHelper.apiTest.get(actionUrl + "/someRandomFile", 0, {} ,this.callback ); },
    error: function(res, b){ specHelper.assert.equal(res.body.error, undefined);},
  },
  "file: missing pages": {
    topic: function(){ specHelper.apiTest.get(actionUrl + "/someRandomFile", 0, {} ,this.callback ); },
    statusCode: function(res, b){ specHelper.assert.equal(res.statusCode, 404);},
    content: function(res, b){ specHelper.assert.equal(res.body, 'Sorry, that file is not found :(');},
  },
  "file: an html page": {
    topic: function(){ specHelper.apiTest.get(actionUrl + "simple.html", 0, {} ,this.callback ); },
    statusCode: function(res, b){ specHelper.assert.equal(res.statusCode, 200);},
    content: function(res, b){ specHelper.assert.equal(res.body, '<h1>ActionHero</h1>\\nI am a flat file being served to you via the API from ./public/index.html<br />');},
  },
  "file: ?filename should work like a path": {
    topic: function(){ specHelper.apiTest.get(actionUrl + "?fileName=simple.html", 0, {} ,this.callback ); },
    statusCode: function(res, b){ specHelper.assert.equal(res.statusCode, 200);},
    content: function(res, b){ specHelper.assert.equal(res.body, '<h1>ActionHero</h1>\\nI am a flat file being served to you via the API from ./public/index.html<br />');},
  },
  "file: index page should be served when requesting a path": {
    topic: function(){ specHelper.apiTest.get(actionUrl, 0, {} ,this.callback ); },
    statusCode: function(res, b){ specHelper.assert.equal(res.statusCode, 200);},
  },
  "file: sub paths should work": {
    topic: function(){ specHelper.apiTest.get(actionUrl + "/logo/actionHero.png", 0, {} ,this.callback ); },
    statusCode: function(res, b){ specHelper.assert.equal(res.statusCode, 200);},
  },
  "file: binary files should work": {
    topic: function(){ specHelper.apiTest.get(actionUrl + "/logo/actionHero.png", 0, {} ,this.callback ); },
    statusCode: function(res, b){ specHelper.assert.equal(res.statusCode, 200);},
    content: function(res, b){ 
		specHelper.assert.equal(res.body.length >= 136836, true);
		specHelper.assert.equal(res.body.length < 136920, true);
	}, // bytes of file
  },
});

// export
suite.export(module);