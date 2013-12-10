var fs = require('fs');
var path = require('path');
var argv = require('optimist').argv;

var configLoader = function(api, next){

  api.configLoader = {
    _start: function(api, callback){
      api.log('environment: ' + api.env);

      api.watchFileAndAct(configFile, function(){
        api.log('\r\n\r\n*** rebooting due to config change ***\r\n\r\n', 'info');
        delete require.cache[require.resolve(configFile)];
        api._commands.restart.call(api._self);
      });

      api.watchFileAndAct(envConfigFile, function(){
        api.log('\r\n\r\n*** rebooting due to environment config change ***\r\n\r\n', 'info');
        delete require.cache[require.resolve(envConfigFile)];
        api._commands.restart.call(api._self);
      });

      callback();
    }
  }

  api.watchedFiles = [];
  api.watchFileAndAct = function(file, callback){
    if(true === api.config.general.developmentMode && api.watchedFiles.indexOf(file) < 0){
      api.watchedFiles.push(file);
      fs.watchFile(file, {interval: 1000}, function(curr, prev){
        if(curr.mtime > prev.mtime){
          process.nextTick(function(){
            callback();
          });
        }
      });
    }
  };
  api.unWatchAllFiles = function(){
    for(var i in api.watchedFiles){
      fs.unwatchFile(api.watchedFiles[i]);
    }
    api.watchedFiles = [];
  };

  if(null !== api._startingParams.api){
    api.utils.hashMerge(api, api._startingParams.api);
  }

  api.env = 'development'
  if(null !== argv['NODE_ENV']){
    api.env = argv['NODE_ENV'];
  } else if(null !== process.env.NODE_ENV){
    api.env = process.env.NODE_ENV;
  }

  var configFile = path.resolve(api.project_root, 'config/config.js');
  if(null !== argv['config']){
    if('/' === argv['config'].charAt(0)){ configFile = argv['config'] }
    else { configFile = path.resolve(api.project_root, argv['config']) }
  } else if(null !== process.env.ACTIONHERO_CONFIG){
    if('/' === process.env.ACTIONHERO_CONFIG.charAt(0)){ configFile = process.env.ACTIONHERO_CONFIG }
    else { configFile = path.resolve(api.project_root, process.env.ACTIONHERO_CONFIG) }
  } else if(!fs.existsSync(configFile)){
    throw new Error(configFile + 'No config.js found in this project, specified with --config, or found in process.env.ACTIONHERO_CONFIG');
  }

  try {
    api.config = require(configFile).config;
  } catch(e){
    throw new Error(configFile + ' is not a valid config file or is not readable: ' + e);
  }

  var envConfigFile = path.resolve(api.project_root, 'config/environments/' + api.env + '.js');
  if(fs.existsSync(envConfigFile)){
    try {
      var envUpdates = require(envConfigFile).config;
      api.config = api.utils.hashMerge(api.config, envUpdates);
    } catch(e){
      throw new Error(envConfigFile + ' is not a valid config file or is not readable: ' + e);
    }
  }

  if(null !== api._startingParams.configChanges){
    api.config = api.utils.hashMerge(api.config, api._startingParams.configChanges);
  }

  next();
}

/////////////////////////////////////////////////////////////////////
// exports
exports.configLoader = configLoader;
