var fs = require('fs');
var path = require('path');
var argv = require('optimist').argv;

var config = function(api, next){

  api.watchedFiles = [];

  if(api._startingParams.api != null){
    api.utils.hashMerge(api, api._startingParams.api);
  }

  if(argv["config"] != null){
    if(argv["config"].charAt(0) == "/"){ var configFile = argv["config"]; }
    else{ var configFile = path.resolve(api.project_root, argv["config"]); }
  }else if(process.env.ACTIONHERO_CONFIG != null){
    if(process.env.ACTIONHERO_CONFIG.charAt(0) == "/"){ var configFile = process.env.ACTIONHERO_CONFIG; }
    else{ var configFile = path.resolve(api.project_root, process.env.ACTIONHERO_CONFIG); }
  }else if(fs.existsSync(api.project_root + '/config.js')){
    var configFile = path.resolve(api.project_root, "config.js");
  }else{
    throw new Error(configFile + "No config.js found in this project, specified with --config, or found in process.env.ACTIONHERO_CONFIG");
    proces.exit(1);
  }

  try{
    api.configData = require(configFile).configData;
  }catch(e){
    throw new Error(configFile + " is not a valid config file or is not readable: " + e);
  }


  if(api._startingParams.configChanges != null){
    api.configData = api.utils.hashMerge(api.configData, api._startingParams.configChanges);
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
