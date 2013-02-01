var fs = require('fs');
var argv = require('optimist').argv;

var config = function(api, startingParams, next){

  api.watchedFiles = [];

  if(startingParams.api != null){
    for(var i in startingParams.api){
      api[i] = startingParams.api[i];
    }
  }
      
  if(argv["config"] != null){
    var configFile = argv["config"];
  }else if(fs.existsSync(process.cwd() + '/config.js')){
    var configFile = process.cwd() + '/config.js';
  }else{
    throw new Error(configFile + "No config.js found in this project or specified with --config");
  }
  try{
    api.configData = require(configFile).configData;
  }catch(e){
    throw new Error(configFile + " is not a valid config file or is not readable: " + e);
  }
  
  if(startingParams.configChanges != null){
    for (var i in startingParams.configChanges){ 
      var collection = startingParams.configChanges[i];
      for (var j in collection){
        api.configData[i][j] = collection[j];
      }
    }
  }

  if(api.configData.general.developmentMode == true){
    api.watchedFiles.push(configFile);
    (function() {
      fs.watchFile(configFile, {interval:1000}, function(curr, prev){
        if(curr.mtime > prev.mtime){
          api.log("\r\n\r\n*** rebooting due to config change ***\r\n\r\n", "info");
          delete require.cache[configFile];
          api._commands.restart.call(api._self);
        }
      });
    })();
  }

  next();
}

/////////////////////////////////////////////////////////////////////
// exports
exports.config = config;
