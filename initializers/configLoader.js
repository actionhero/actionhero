var fs = require('fs');
var path = require('path');
var argv = require('optimist').argv;

var configLoader = function(api, next){

  api.configLoader = {
    _start: function(api, callback){
      api.log('environment: ' + api.env);
      callback();
    }
  }

  api.watchedFiles = [];

  api.watchFileAndAct = function(file, callback){
    if(api.config.general.developmentMode == true && api.watchedFiles.indexOf(file) < 0){
      api.watchedFiles.push(file);
      fs.watchFile(file, {interval: 1000}, function(curr, prev){
        if(curr.mtime > prev.mtime){
          process.nextTick(function(){
            var cleanPath = file;
            if(process.platform === 'win32'){
              cleanPath = file.replace(/\//g, '\\');
            }
            delete require.cache[require.resolve(cleanPath)];
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

  if(api._startingParams.api != null){
    api.utils.hashMerge(api, api._startingParams.api);
  }

  api.env = 'development'

  if(argv['NODE_ENV'] != null){
    api.env = argv['NODE_ENV'];
  } else if(process.env.NODE_ENV != null){
    api.env = process.env.NODE_ENV;
  }

  var configPath = path.resolve(api.project_root, 'config');

  if(argv['config'] != null){
    if(argv['config'].charAt(0) == '/'){ configPath = argv['config'] }
    else { configPath = path.resolve(api.project_root, argv['config']) }
  } else if(process.env.ACTIONHERO_CONFIG != null) {
    if(process.env.ACTIONHERO_CONFIG.charAt(0) == '/'){ configPath = process.env.ACTIONHERO_CONFIG }
    else { configPath = path.resolve(api.project_root, process.env.ACTIONHERO_CONFIG) }
  } else if(!fs.existsSync(configPath)){
    throw new Error(configPath + 'No config directory found in this project, specified with --config, or found in process.env.ACTIONHERO_CONFIG');
  }

  api.config = {};

  configFiles = api.utils.recusiveDirecotryGlob(configPath);
  configFiles.forEach(function(f){
    var localConfig = require(f);
    if(localConfig.default != null){  api.config = api.utils.hashMerge(api.config, localConfig.default, api); }
    if(localConfig[api.env] != null){ api.config = api.utils.hashMerge(api.config, localConfig[api.env], api); }

    api.watchFileAndAct(f, function(){
      api.log('\r\n\r\n*** rebooting due to config change ***\r\n\r\n', 'info');
      delete require.cache[require.resolve(f)];
      api.commands.restart.call(api._self);
    });
  })

  // We load the config twice.
  // This is to allow 'literal' values to be loaded whenever possible, and then for refrences to be resolved
  configFiles.forEach(function(f){
    var localConfig = require(f);
    if(localConfig.default != null){  api.config = api.utils.hashMerge(api.config, localConfig.default, api); }
    if(localConfig[api.env] != null){ api.config = api.utils.hashMerge(api.config, localConfig[api.env], api); }
  })

  if(api._startingParams.configChanges != null){
    api.config = api.utils.hashMerge(api.config, api._startingParams.configChanges);
  }

  api.config.general.paths.plugin.forEach(function(p){
    api.config.general.plugins.forEach(function(plugin){
      var pluginPackageBase = path.normalize(p + '/' + plugin);
      if(api.project_root != pluginPackageBase){
        var found = false;
        if(fs.existsSync(pluginPackageBase + "/actions")){      api.config.general.paths.action.push(      pluginPackageBase + '/actions'      );}
        if(fs.existsSync(pluginPackageBase + "/tasks")){        api.config.general.paths.task.push(        pluginPackageBase + '/tasks'        );}
        if(fs.existsSync(pluginPackageBase + "/servers")){      api.config.general.paths.server.push(      pluginPackageBase + '/servers'      );}
        if(fs.existsSync(pluginPackageBase + "/initializers")){ api.config.general.paths.initializer.push( pluginPackageBase + '/initializers' );}
      }
    });    
  });

  next();
}

/////////////////////////////////////////////////////////////////////
// exports
exports.configLoader = configLoader;
