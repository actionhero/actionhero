var specHelper = require('../helpers/_specHelper.js').specHelper;
var suite = specHelper.vows.describe('catching task and action exceptions');
var apiObj = {};

suite.addBatch({
  'specHelper.prepare':{
    topic: function(){ var cb = this.callback; specHelper.prepare(0, function(api){ apiObj = specHelper.cleanAPIObject(api); cb(); }) },
    api_object_should_exist: function(){ specHelper.assert.isObject(apiObj); } }
});

try{
  require('domain');

  suite.addBatch({
    'I can inject a bad task that breaks':{
      topic: function(){ 
        var cb = this.callback; 
        apiObj.actions['badAction'] = { 
          name: 'badAction',
          description: 'I will break',
          inputs: { required: [], optional: [] },
          outputExample: { },
          run: function(api, connection, next){
            api.log(thing);
            next(connection, true);
          }
        }
        cb(false);
      },
      new_action_exists: function(){ specHelper.assert.isObject(apiObj.actions['badAction']); } }
  });

  suite.addBatch({
    "bad action breaks": {
      topic: function(){ specHelper.apiTest.get('/badAction', 0, {} ,this.callback ); },
      error: function(res, b){ 
        specHelper.assert.equal(res.body.error, "The server experienced an internal error");
      },
    }
  });

  suite.addBatch({
    "random numbers still works": {
      topic: function(){ specHelper.apiTest.get('/randomNumber', 0, {} ,this.callback ); },
      error: function(res, b){ 
        var randomNumber = res.body.randomNumber;
        specHelper.assert.equal("OK", res.body.error); 
        specHelper.assert.isNumber(randomNumber); 
      },
    }
  });

  suite.addBatch({
    'I can remove the bad action':{
      topic: function(){ 
        var cb = this.callback; 
        apiObj.actions['badAction'] = null
        cb(false);
      },
      new_action_exists: function(){ specHelper.assert.equal(apiObj.actions['badAction'], null); } }
  });
}catch(e){
  console.log("the exception test can only run for node >= v0.8.0; skipping")
} 

// export
suite.export(module);