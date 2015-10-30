var fs = require('fs');
var path = require('path');
var util = require('util');
var argv = require('optimist').argv;

module.exports = {
  loadPriority:  0,
  initialize: function(api, next){

    api.watchedFiles = [];

    api.watchFileAndAct = function(file, callback){
      file = path.normalize(file);
      if(!fs.existsSync(file)){
        throw new Error(file + ' does not exist, and cannot be watched')
      }
      if(api.config.general.developmentMode === true && api.watchedFiles.indexOf(file) < 0){
        api.watchedFiles.push(file);
        fs.watchFile(file, {interval: 1000}, function(curr, prev){
          if(curr.mtime > prev.mtime && api.config.general.developmentMode === true){
            process.nextTick(function(){
              var cleanPath = file;
              if(process.platform === 'win32'){
                cleanPath = file.replace(/\//g, '\\');
              }
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

    if(api._startingParams.api){
      api.utils.hashMerge(api, api._startingParams.api);
    }

    api.env = 'development'

    if(argv.NODE_ENV){
      api.env = argv.NODE_ENV;
    } else if(process.env.NODE_ENV){
      api.env = process.env.NODE_ENV;
    }

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

    function addConfigPath(pathToCheck, alreadySplit) {
      if (typeof pathToCheck === 'string') {
        if (!alreadySplit) {
          addConfigPath(pathToCheck.split(','), true);
        }
        else {
          if (pathToCheck.charAt(0) !== '/') pathToCheck = path.resolve(api.projectRoot, pathToCheck);
          if (fs.existsSync(pathToCheck)) {
            configPaths.push(pathToCheck);
          }
        }
      } else if (util.isArray(pathToCheck)) {
        pathToCheck.map(function(entry) {
          addConfigPath(entry, alreadySplit);
        });
      }
    }

    [argv.config, process.env.ACTIONHERO_CONFIG].map(function(entry) {
      addConfigPath(entry, false);
    });
    if (configPaths.length < 1) {
      addConfigPath('config', false);
    }
    if (configPaths.length < 1) {
      throw new Error(configPaths + 'No config directory found in this project, specified with --config, or found in process.env.ACTIONHERO_CONFIG');
    }

    var rebootCallback = function(file){
      api.log('\r\n\r\n*** rebooting due to config change (' + file + ') ***\r\n\r\n', 'info');
      delete require.cache[require.resolve(file)];
      api.commands.restart.call(api._self);
    }

    api.loadConfigDirectory = function(configPath, watch){
      var configFiles = api.utils.recursiveDirectoryGlob(configPath);

      var loadRetries = 0;
      var loadErrors = {};
      for(var i = 0, limit = configFiles.length; (i < limit); i++){
        var f = configFiles[i];
        try{
          // attempt configuration file load
          var localConfig = require(f);
          if(localConfig.default){  api.config = api.utils.hashMerge(api.config, localConfig.default, api); }
          if(localConfig[api.env]){ api.config = api.utils.hashMerge(api.config, localConfig[api.env], api); }
          // configuration file load success: clear retries and
          // errors since progress has been made
          loadRetries = 0;
          loadErrors = {};
        } catch(error){
          // error loading configuration, abort if all remaining
          // configuration files have been tried and failed
          // indicating inability to progress
          loadErrors[f] = error.toString();
          if(++loadRetries === limit-i){
              throw new Error('Unable to load configurations, errors: '+JSON.stringify(loadErrors));
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
        if(localConfig.default){  api.config = api.utils.hashMerge(api.config, localConfig.default, api); }
        if(localConfig[api.env]){ api.config = api.utils.hashMerge(api.config, localConfig[api.env], api); }
      });

    }

    api.config = {};

    //load the default config of actionhero
    api.loadConfigDirectory(__dirname + '/../config', false);

    //load the project specific config
    configPaths.map(api.loadConfigDirectory);

    // apply any configChanges
    if(api._startingParams.configChanges){
      api.config = api.utils.hashMerge(api.config, api._startingParams.configChanges);
    }

    var pluginActions      = [];
    var pluginTasks        = [];
    var pluginServers      = [];
    var pluginInitializers = [];
    var pluginPublics      = [];

    //loop over it's plugins
    api.config.general.paths.plugin.forEach(function(p){
      api.config.general.plugins.forEach(function(plugin){
        var pluginPackageBase = path.normalize(p + '/' + plugin);
        if(api.projectRoot !== pluginPackageBase){
          if(fs.existsSync(pluginPackageBase + '/config')){
            //and merge the plugin config
            api.loadConfigDirectory( pluginPackageBase + '/config', false);
            //collect all paths that could have multiple target folders
            pluginActions      = pluginActions.concat(api.config.general.paths.action);
            pluginTasks        = pluginTasks.concat(api.config.general.paths.task);
            pluginServers      = pluginServers.concat(api.config.general.paths.server);
            pluginInitializers = pluginInitializers.concat(api.config.general.paths.initializer);
            pluginPublics      = pluginPublics.concat(api.config.general.paths.public);
          }
          //additionally add the following paths if they exists
          if(fs.existsSync(pluginPackageBase + '/actions')){      pluginActions.unshift(      pluginPackageBase + '/actions'      );}
          if(fs.existsSync(pluginPackageBase + '/tasks')){        pluginTasks.unshift(        pluginPackageBase + '/tasks'        );}
          if(fs.existsSync(pluginPackageBase + '/servers')){      pluginServers.unshift(      pluginPackageBase + '/servers'      );}
          if(fs.existsSync(pluginPackageBase + '/initializers')){ pluginInitializers.unshift( pluginPackageBase + '/initializers' );}
          if(fs.existsSync(pluginPackageBase + '/public')){       pluginPublics.unshift(      pluginPackageBase + '/public'       );}
        }
      });
    });

    //now load the project config again to overrule plugin configs
    configPaths.map(api.loadConfigDirectory);

    //apply plugin paths for actions, tasks, servers and initializers
    api.config.general.paths.action      = pluginActions.concat(api.config.general.paths.action);
    api.config.general.paths.task        = pluginTasks.concat(api.config.general.paths.task);
    api.config.general.paths.server      = pluginServers.concat(api.config.general.paths.server);
    api.config.general.paths.initializer = pluginInitializers.concat(api.config.general.paths.initializer);
    api.config.general.paths.public      = pluginPublics.concat(api.config.general.paths.public);

    // the first plugin path shoud alawys be the local project
    api.config.general.paths.public.reverse();

    //finally re-merge starting params into the config
    if(api._startingParams.configChanges){
      api.config = api.utils.hashMerge(api.config, api._startingParams.configChanges);
    }

    // cleanup
    api.config.general.paths.action      = api.utils.arrayUniqueify( api.config.general.paths.action.map(path.normalize) );
    api.config.general.paths.task        = api.utils.arrayUniqueify( api.config.general.paths.task.map(path.normalize) );
    api.config.general.paths.server      = api.utils.arrayUniqueify( api.config.general.paths.server.map(path.normalize) );
    api.config.general.paths.initializer = api.utils.arrayUniqueify( api.config.general.paths.initializer.map(path.normalize) );
    api.config.general.paths.public      = api.utils.arrayUniqueify( api.config.general.paths.public.map(path.normalize) );
    api.config.general.paths.pid         = api.utils.arrayUniqueify( api.config.general.paths.pid.map(path.normalize) );
    api.config.general.paths.log         = api.utils.arrayUniqueify( api.config.general.paths.log.map(path.normalize) );
    api.config.general.paths.plugin      = api.utils.arrayUniqueify( api.config.general.paths.plugin.map(path.normalize) );

    process.nextTick(next);
  },

  start: function(api, callback){
    api.log('environment: ' + api.env, 'notice');
    callback();
  }

}