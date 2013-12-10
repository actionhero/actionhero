var fs = require('fs');

var actions = function(api, next){
  api.actions = {};
  api.actions.actions = {};
  api.actions.versions = {};

  api.actions.preProcessors = [];
  api.actions.postProcessors = [];

  if(null === api.config.general.simultaneousActions){
    api.config.general.simultaneousActions = 5;
  }

  api.actions.validateAction = function(action){
    var fail = function(msg){
      api.log(msg + '; exiting.', 'emerg');
    }

    if('string' !== typeof action.name || action.name.length < 1){
      fail('an action is missing \'action.name\'');
      return false;
    } else if('string' !== typeof action.description || action.description.length < 1){
      fail('Action ' + action.name + ' is missing \'action.description\'');
      return false;
    } else if('object' !== typeof action.inputs){
      fail('Action ' + action.name + ' has no inputs');
      return false;
    } else if('object' !== typeof action.inputs.required){
      fail('Action ' + action.name + ' has no required inputs');
      return false;
    } else if('object' !== typeof action.inputs.optional){
      fail('Action ' + action.name + ' has no optional inputs');
      return false;
    } else if('object' !== typeof action.outputExample){
      fail('Action ' + action.name + ' has no outputExample');
      return false;
    } else if('function' !== typeof action.run){
      fail('Action ' + action.name + ' has no run method');
      return false;
    } else if(null !== api.connections && api.connections.allowedVerbs.indexOf(action.name) >= 0){
      fail(action.name + ' is a reserved verb for connections. choose a new name');
      return false;
    } else {
      return true;
    }
  }

  api.actions.loadDirectory = function(path){
    if(null === path){
      path = api.config.general.paths.action;
      if(!fs.existsSync(api.config.general.paths.action)){
        api.log(api.config.general.paths.action + ' defined as action path, but does not exist', 'warning');
      }
    }
    fs.readdirSync(path).forEach( function(file) {
      if('/' !== path[path.length - 1]){ path += '/' }
      var fullFilePath = path + file;
      if('.' !== file[0]){
        var stats = fs.statSync(fullFilePath);
        if(stats.isDirectory()){
          api.actions.loadDirectory(fullFilePath);
        } else if(stats.isSymbolicLink()){
          var realPath = fs.readlinkSync(fullFilePath);
          api.actions.loadDirectory(realPath);
        } else if(stats.isFile()){
          var fileParts = file.split('.');
          var ext = fileParts[(fileParts.length - 1)];
          if('js' === ext){ api.actions.loadFile(fullFilePath) }
        } else {
          api.log(file + ' is a type of file I cannot read', 'error')
        }
      }
    });
  }

  api.actions.loadFile = function(fullFilePath, reload){
    if(null === reload){ reload = false }

    var loadMessage = function(action){
      var msgString = '';
      if(reload){
        msgString = 'action (re)loaded: ' + action.name + ' @ v' + action.version + ', ' + fullFilePath;
      } else {
        msgString = 'action loaded: ' + action.name + ' @ v' + action.version + ', ' + fullFilePath;
      }
      api.log(msgString, 'debug');
    }

    api.watchFileAndAct(fullFilePath, function(){
      var cleanPath = fullFilePath;
      if('win32' === process.platform){
        cleanPath = fullFilePath.replace(/\//g, '\\');
      }

      delete require.cache[require.resolve(cleanPath)];
      api.actions.loadFile(fullFilePath, true);
      api.params.buildPostVariables();
    })

    try {
      var collection = require(fullFilePath);
      for(var i in collection){
        var action = collection[i];
        if(null === action.version){ action.version = 1.0 }
        if(null === api.actions.actions[action.name]){ api.actions.actions[action.name] = {} }
        api.actions.actions[action.name][action.version] = action;
        if(null === api.actions.versions[action.name]){
          api.actions.versions[action.name] = [];
        }
        api.actions.versions[action.name].push(action.version);
        api.actions.versions[action.name].sort();
        api.actions.validateAction(api.actions.actions[action.name][action.version]);
        loadMessage(action);
      }
    } catch(err){
      api.exceptionHandlers.loader(fullFilePath, err);
      delete api.actions.actions[action.name][action.version];
    }
  }

  api.actions.loadDirectory();
  next();
  
}

/////////////////////////////////////////////////////////////////////
// exports
exports.actions = actions;
