var specHelper = require('../helpers/_specHelper.js').specHelper;
var suite = specHelper.vows.describe('reloading of actions in development mode');
var apiObj = {};

suite.addBatch({
  'specHelper.prepare':{
    topic: function(){ var cb = this.callback; specHelper.prepare(0, function(api){ apiObj = specHelper.cleanAPIObject(api); cb(); }) },
    api_object_should_exist: function(){ specHelper.assert.isObject(apiObj); } }
});

suite.addBatch({
  "random numbers": {
    topic: function(){ specHelper.apiTest.get('/randomNumber', 0, {} ,this.callback ); },
    error: function(res, b){ 
      var randomNumber = res.body.randomNumber;
      specHelper.assert.equal("OK", res.body.error); 
      specHelper.assert.isNumber(randomNumber); 
    },
  }
});

var original_file = "./actions/randomNumber.js";
var original_content = specHelper.fs.readFileSync(original_file);

var new_file_content = "";
new_file_content += "var action = {};";
new_file_content += "action.name = \"randomNumber\";";
new_file_content += "action.description = \"HACK\";";
new_file_content += "action.inputs = { \"required\" : [], \"optional\" : [] };";
new_file_content += "action.outputExample = {randomNumber: 123};";
new_file_content += "action.run = function(api, connection, next){";
new_file_content += "  connection.response.randomNumber = \"not a number!\";";
new_file_content += "  next(connection, true);";
new_file_content += "};";
new_file_content += "exports.action = action;";

suite.addBatch({
  "I can wait a sec to let the first stat run...": {
    topic: function(){ 
      var cb = this.callback;
      setTimeout(function(){
        cb();
      }, 1001); //file read timer is 1 second; let it have time to get one read in first
    },
    file_is_real: function(){ 
      stats = specHelper.fs.lstatSync(original_file);
      specHelper.assert.equal(stats.isFile(), true);
    },
  }
});

suite.addBatch({
  "I can change the file and new actions will be loaded up": {
    topic: function(){ 
      var cb = this.callback;
      specHelper.fs.writeFile(original_file, new_file_content, function(err) {
        setTimeout(function(){
          specHelper.apiTest.get('/randomNumber', 0, {} , cb );
        }, 3000); //file read timer is 1 second; time to notice the change + time to reaload API
      });
    },
    changed_content: function(res, b){ 
      var randomNumber = res.body.randomNumber;
      specHelper.assert.equal(apiObj.actions.randomNumber.description, "HACK");
      specHelper.assert.equal(randomNumber, "not a number!");
    },
  }
});

suite.addBatch({
  "I can wait a sec to let the first stat run again": {
    topic: function(){ 
      var cb = this.callback;
      setTimeout(function(){
        cb();
      }, 1001); //file read timer is 1 second; let it have time to get one read in first
    },
    file_is_still_real: function(){ 
      stats = specHelper.fs.lstatSync(original_file);
      specHelper.assert.equal(stats.isFile(), true);
    },
  }
});

suite.addBatch({
  "I can put back the original file...": {
    topic: function(){ 
      var cb = this.callback;
      specHelper.fs.writeFile(original_file, original_content, function(err){
        setTimeout(function(){
          specHelper.apiTest.get('/randomNumber', 0, {} , cb );
        }, 3000); //file read timer is 1 second; time to notice the change + time to reaload API
      });
    },
    error: function(res, b){ 
      var randomNumber = res.body.randomNumber;
      specHelper.assert.equal("OK", res.body.error); 
      specHelper.assert.isNumber(randomNumber);
      specHelper.assert.isTrue(randomNumber < 1);
      specHelper.assert.isTrue(randomNumber > 0);
    },
  }
});

// export
suite.export(module);