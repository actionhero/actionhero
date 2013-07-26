// A collection of helpful JAKE scripts for actionhero. 
// You can create your own jake scripts in your project's Jakefile.js
// More information about Jake can be found at https://github.com/mde/jake/

var fs = require("fs");
var path = require("path");

/////////////
// HELPERS //
/////////////

var file_exists = function(file){
  try{
    var stats = fs.lstatSync(file);
    if(stats.isFile() || stats.isSymbolicLink()){
      return true;
    }else{
      return false;
    }
  }catch(e){
    return false;
  }
}

var api = function(){
  return jake.Task["actionhero:environment"].value;
}

var exitWithError = function(error){
  if(error != null){
    console.log("Error: " + String(error));
    process.exit();
  }
}

///////////
// TASKS //
///////////

namespace("actionhero", function(){
  desc("I will load and init an actionhero environment");
  task("environment", {async: true}, function() {
    if(file_exists(__dirname + "/../actionhero.js")){
      // in the actionhero project itself
      var actionhero_root = __dirname + "/..";
    }else if(file_exists(__dirname + "/../node_modules/actionhero/actionhero.js")){
      // running from a project's node_modules (bin or actionhero)
      var actionhero_root = __dirname + "/../node_modules/actionhero";
    }else{
      // installed globally
      var actionhero_root = path.normalize(__dirname + "/..");
    }
    var actionheroPrototype = require(actionhero_root + "/actionhero.js").actionheroPrototype;
    var actionhero = new actionheroPrototype();

    var configChanges = {
      logger: {
        transports: null,
      }
    }
    actionhero.initialize({configChanges: configChanges}, function(err, api){
      complete(api);   
    });
  });  
});

namespace("actionhero", function(){
  namespace("actions", function(){

    desc("List your actions and metadata");
    task("list", ["actionhero:environment"], {async: true}, function(){
      for(var collection in api().actions.actions){
        console.log(collection)
        for(var version in api().actions.actions[collection]){
          var action = api().actions.actions[collection][version];
          console.log("  " + "version: " + version);
          console.log("    " + action.description);
          console.log("    " + "required inputs: " + action.inputs.required.join(", "));
          console.log("    " + "optional inputs: " + action.inputs.optional.join(", "));
        }
      };
      complete(process.exit());
    });

  });
});

namespace("actionhero", function(){
  namespace("redis", function(){

    desc("This will clear the entire actionhero redis database");
    task("flush", ["actionhero:environment"], {async: true}, function(){
      api().redis.client.flushdb(function(error, data){
        exitWithError(error);
        console.log("flushed")
        complete(process.exit());
      });
    });

  });
});

namespace("actionhero", function(){
  namespace("cache", function(){

    desc("This will clear actionhero's cache");
    task("clear", ["actionhero:environment"], {async: true}, function(){
      api().cache.size(function(error, count){
        exitWithError(error);
        api().redis.client.del(api().cache.redisCacheKey, function(error){
          exitWithError(error);
          console.log("cleared " + count + " items from the cache");
          complete(process.exit());
        });
      });
    });

    desc("This will save the current cache as a JSON object");
    task("dump", ["actionhero:environment"], {async: true}, function(file){
      if(file == null){ file = "cache.dump"; }
      api().cache.size(function(error, count){
        exitWithError(error);
        api().redis.client.hgetall(api().cache.redisCacheKey, function(error, data){
          exitWithError(error);
          fs.writeFileSync(file, JSON.stringify(data));
          console.log("dumped " + count + " items from the cache");
          complete(process.exit());
        });
      });
    });

    desc("This will load (and overwrite) the cache from a file");
    task("load", ["actionhero:environment"], {async: true}, function(file){
      if(file == null){ file = "cache.dump"; }
        var data = JSON.parse( fs.readFileSync(file) );
        api().redis.client.hmset(api().cache.redisCacheKey, data, function(error, data){
          exitWithError(error);      
          api().cache.size(function(error, count){
            exitWithError(error);    
            console.log("loaded " + count + " items into the cache");
            complete(process.exit());
          });
        });
    });

  });
});

