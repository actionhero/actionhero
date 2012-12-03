var initConfig = function(api, startingParams, next){

  api.watchedFiles = [];

  if(startingParams.api != null){
    for(var i in startingParams.api){
      api[i] = startingParams.api[i];
    }
  }
      
  if(api.argv["config"] != null){
    var configFile = api.argv["config"];
    console.log(' >> configuration read from: ' + api.argv["config"]);
  }else if(api.fs.existsSync(process.cwd() + '/config.js')){
    var configFile = process.cwd() + '/config.js';
  }else{
    var configFile = __dirname + "/../config.js";
    console.log(' >> no local config.json, using default from '+configFile);
  }
  try{
    api.configData = require(configFile).configData;
  }catch(e){
    throw new Error(configFile + " is not a valid config file or is not readable");
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
      api.fs.watchFile(configFile, {interval:1000}, function(curr, prev){
        if(curr.mtime > prev.mtime){
          api.log("\r\n\r\n*** rebooting due to config change ***\r\n\r\n");
          delete require.cache[configFile];
          actionHero.restart();
        }
      });
    })();
  }

  next();
}

/////////////////////////////////////////////////////////////////////
// exports
exports.initConfig = initConfig;
