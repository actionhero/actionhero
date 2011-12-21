var specHelper = require('../specHelper.js').specHelper;
var suite = specHelper.vows.describe('action: file');
var apiObj = {};

var actionUrl = "/file/";

suite.addBatch({
  'specHelper.prepare':{
    topic: function(){ var cb = this.callback; specHelper.prepare(function(api){ apiObj = specHelper.cleanAPIObject(api); cb(); }) },
    'api object should exist': function(){ specHelper.assert.isObject(apiObj); } }
});

suite.addBatch({
  "file: response is NOT json": {
    topic: function(){ specHelper.apiTest.get(actionUrl + "/someRandomFile", {} ,this.callback ); },
    error: function(res, b){ specHelper.assert.equal(res.body.error, undefined);},
  },
  "file: missing pages": {
    topic: function(){ specHelper.apiTest.get(actionUrl + "/someRandomFile", {} ,this.callback ); },
    statusCode: function(res, b){ specHelper.assert.equal(res.statusCode, 404);},
    content: function(res, b){ specHelper.assert.equal(res.body, 'Sorry, that file is not found :(');},
  },
  "file: an html page": {
    topic: function(){ specHelper.apiTest.get(actionUrl + "index.html", {} ,this.callback ); },
    statusCode: function(res, b){ specHelper.assert.equal(res.statusCode, 200);},
    content: function(res, b){ specHelper.assert.equal(res.body, '<h1>Hello!</h1>\nI am a flat file being served to you via the API. <br />\nEnjoy!');},
  },
  "file: ?filename should work like a path": {
    topic: function(){ specHelper.apiTest.get(actionUrl + "?filename=index.html", {} ,this.callback ); },
    statusCode: function(res, b){ specHelper.assert.equal(res.statusCode, 200);},
    content: function(res, b){ specHelper.assert.equal(res.body, '<h1>Hello!</h1>\nI am a flat file being served to you via the API. <br />\nEnjoy!');},
  },
  "file: index page should be served when requesting a path": {
    topic: function(){ specHelper.apiTest.get(actionUrl, {} ,this.callback ); },
    statusCode: function(res, b){ specHelper.assert.equal(res.statusCode, 200);},
    content: function(res, b){ specHelper.assert.equal(res.body, '<h1>Hello!</h1>\nI am a flat file being served to you via the API. <br />\nEnjoy!');},
  },
  "file: sub paths should work": {
    topic: function(){ specHelper.apiTest.get(actionUrl + "/img/piano.jpg", {} ,this.callback ); },
    statusCode: function(res, b){ specHelper.assert.equal(res.statusCode, 200);},
  },
  "file: binary files should work": {
    topic: function(){ specHelper.apiTest.get(actionUrl + "/img/piano.jpg", {} ,this.callback ); },
    statusCode: function(res, b){ specHelper.assert.equal(res.statusCode, 200);},
    content: function(res, b){ specHelper.assert.equal(res.body.length, 41752);}, // bytes of file
  },
});

// export
suite.export(module);