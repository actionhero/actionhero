'use strict';

var fs = require('fs');
var path = require('path');
var util = require('util');
var argv = require('optimist').argv;

module.exports = {
  loadPriority:  0,
  initialize: function(api, next){

    // api.env

    if(api._startingParams && api._startingParams.api){
      api.utils.hashMerge(api, api._startingParams.api);
    }

    api.env = 'development';

    if(argv.NODE_ENV){
      api.env = argv.NODE_ENV;
    }else if(process.env.NODE_ENV){
      api.env = process.env.NODE_ENV;
    }

    // reloading in development mode

    api.watchedFiles = [];

    api.watchFileAndAct = function(file, callback){
      file = path.normalize(file);

      if(!fs.existsSync(file)){
        throw new Error(file + ' does not exist, and cannot be watched');
      }

      if(api.config.general.developmentMode === true && api.watchedFiles.indexOf(file) < 0){
        api.watchedFiles.push(file);
        fs.watchFile(file, {interval: 1000}, function(curr, prev){
          if(
            api.running === true &&
            api.config.general.developmentMode === true &&
            curr.mtime > prev.mtime
          ){
            process.nextTick(function(){
              var cleanPath = file;
              if(process.platform === 'win32'){ cleanPath = file.replace(/\//g, '\\'); }
              delete require.cache[require.resolve(cleanPath)];
              callback(file);
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

    // We support multiple configuration paths as follows:
    //
    // 1. Use the project 'config' folder, if it exists.
    // 2. "actionhero --config=PATH1 --config=PATH2 --config=PATH3,PATH4"
    // 3. "ACTIONHERO_CONFIG=PATH1,PATH2 npm start"
    //
    // Note that if --config or ACTIONHERO_CONFIG are used, they _overwrite_ the use of the default "config" folder. If
    // you wish to use both, you need to re-specify "config", e.g. "--config=config,local-config". Also, note that
    // specifying multiple --config options on the command line does exactly the same thing as using one parameter with
    // comma separators, however the environment variable method only supports the comma-delimited syntax.
    var configPaths = [];

    function addConfigPath(pathToCheck, alreadySplit){
      if(typeof pathToCheck === 'string'){
        if(!alreadySplit){
          addConfigPath(pathToCheck.split(','), true);
        }else{
          if(pathToCheck.charAt(0) !== '/'){
            pathToCheck = path.resolve(api.projectRoot, pathToCheck);
          }
          if(fs.existsSync(pathToCheck)){
            configPaths.push(pathToCheck);
          }
        }
      }else if(util.isArray(pathToCheck)){
        pathToCheck.map(function(entry){
          addConfigPath(entry, alreadySplit);
        });
      }
    }

    [argv.config, process.env.ACTIONHERO_CONFIG].map(function(entry){ addConfigPath(entry, false); });

    if(configPaths.length < 1){
      addConfigPath('config', false);
    }

    if(configPaths.length < 1){
      return next(new Error(configPaths + 'No config directory found in this project, specified with --config, or found in process.env.ACTIONHERO_CONFIG'));
    }

    var rebootCallback = function(file){
      api.log(['*** rebooting due to config change (%s) ***', file], 'info');
      delete require.cache[require.resolve(file)];
      api.commands.restart.call(api._self);
    };

    api.loadConfigDirectory = function(configPath, watch){
      var configFiles = api.utils.recursiveDirectoryGlob(configPath);

      var loadRetries = 0;
      var loadErrors = {};
      for(var i = 0, limit = configFiles.length; (i < limit); i++){
        var f = configFiles[i];
        try{
          // attempt configuration file load
          var localConfig = require(f);
          if(localConfig['default']){  api.config = api.utils.hashMerge(api.config, localConfig['default'], api); }
          if(localConfig[api.env]){ api.config = api.utils.hashMerge(api.config, localConfig[api.env], api); }
          // configuration file load success: clear retries and
          // errors since progress has been made
          loadRetries = 0;
          loadErrors = {};
        }catch(error){
          // error loading configuration, abort if all remaining
          // configuration files have been tried and failed
          // indicating inability to progress
          loadErrors[f] = {error: error, msg: error.toString()};
          if(++loadRetries === limit - i){
            Object.keys(loadErrors).forEach(function(e){
              console.log(loadErrors[e].error.stack);
              console.log('');
              delete loadErrors[e].error;
            });

            return next(new Error('Unable to load configurations, errors: ' + JSON.stringify(loadErrors)));
          }
          // adjust configuration files list: remove and push
          // failed configuration to the end of the list and
          // continue with next file at same index
          configFiles.push(configFiles.splice(i--, 1)[0]);
          continue;
        }

        if(watch !== false){
          // configuration file loaded: set watch
          api.watchFileAndAct(f, rebootCallback);
        }
      }

      // We load the config twice. Utilize configuration files load order that succeeded on the first pass.
      // This is to allow 'literal' values to be loaded whenever possible, and then for refrences to be resolved
      configFiles.forEach(function(f){
        var localConfig = require(f);
        if(localConfig['default']){  api.config = api.utils.hashMerge(api.config, localConfig['default'], api); }
        if(localConfig[api.env]){ api.config = api.utils.hashMerge(api.config, localConfig[api.env], api); }
      });

    };

    api.config = {};

    //load the default config of actionhero
    api.loadConfigDirectory(__dirname + '/../config', false);

    //load the project specific config
    configPaths.map(api.loadConfigDirectory);

    // apply any configChanges
    if(api._startingParams && api._startingParams.configChanges){
      api.config = api.utils.hashMerge(api.config, api._startingParams.configChanges);
    }

    process.nextTick(next);
  },

  start: function(api, callback){
    api.log(['environment: %s', api.env], 'notice');
    callback();
  }

};
