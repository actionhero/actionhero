var fs = require('fs');
var argv = require('optimist').argv;

var config = function(api, startingParams, next){

  api.watchedFiles = [];

  if(startingParams.api != null){
    api.utils.hashMerge(api, startingParams.api);
  }
      
  if(argv["config"] != null){
    var configFile = argv["config"];
  }else if(process.env.ACTIONHERO_CONFIG != null){
    var configFile = process.env.ACTIONHERO_CONFIG;
  }else if(fs.existsSync(process.cwd() + '/config.js')){
    var configFile = process.cwd() + '/config.js';
  }else{
    throw new Error(configFile + "No config.js found in this project, specified with --config, or found in process.env.ACTIONHERO_CONFIG");
    proces.exit(1);
  }

  try{
    api.configData = require(configFile).configData;
  }catch(e){
    throw new Error(configFile + " is not a valid config file or is not readable: " + e);
  }


  if(startingParams.configChanges != null){
    api.configData = api.utils.hashMerge(api.configData, startingParams.configChanges);
  }

  if(api.configData.general.developmentMode == true){
    api.watchedFiles.push(configFile);
    (function() {
      fs.watchFile(configFile, {interval:1000}, function(curr, prev){
        if(curr.mtime > prev.mtime){
          api.log("\r\n\r\n*** rebooting due to config change ***\r\n\r\n", "info");
          delete require.cache[require.resolve(configFile)];
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
