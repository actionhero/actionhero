var fs = require('fs');

var actions = function(api, next){
  api.actions = {};
  api.actions.actions = {};
  api.actions.versions = {};

  api.actions.preProcessors = [];
  api.actions.postProcessors = [];

  if(api.configData.general.simultaneousActions == null){
    api.configData.general.simultaneousActions = 5;
  }

  api.actions.validateAction = function(action){
    var fail = function(msg){
      api.log(msg + "; exiting.", "emerg");
    }

    if(typeof action.name != "string" || action.name.length < 1){
      fail("an action is missing `action.name`");
      return false;
    }else if(typeof action.description != "string" || action.description.length < 1){
      fail("Action "+action.name+" is missing `action.description`");
      return false;
    }else if(typeof action.inputs != "object"){
      fail("Action "+action.name+" has no inputs");
      return false;
    }else if(typeof action.inputs.required != "object"){
      fail("Action "+action.name+" has no required inputs");
      return false;
    }else if(typeof action.inputs.optional != "object"){
      fail("Action "+action.name+" has no optional inputs");
      return false;
    }else if(typeof action.outputExample != "object"){
      fail("Action "+action.name+" has no outputExample");
      return false;
    }else if(typeof action.run != "function"){
      fail("Action "+action.name+" has no run method");
      return false;
    }else if(api.connections != null && api.connections.allowedVerbs.indexOf(action.name) >= 0){
      fail(action.name+" is a reserved verb for connections. choose a new name");
      return false;
    }else{
      return true;
    }
  }

  api.actions.loadDirectory = function(path){
    if(path == null){ 
      path = api.configData.general.paths.action;
      if(!fs.existsSync(api.configData.general.paths.action)){
        api.log(api.configData.general.paths.action + " defeined as action path, but does not exist", 'warning');
      }
    }
    fs.readdirSync(path).forEach( function(file) {
      if(path[path.length - 1] != "/"){ path += "/"; } 
      var fullFilePath = path + file;
      if (file[0] != "."){
        var stats = fs.statSync(fullFilePath);
        if(stats.isDirectory()){
          api.actions.loadDirectory(fullFilePath);
        }else if(stats.isSymbolicLink()){
          var realPath = fs.readlinkSync(fullFilePath);
          api.actions.loadDirectory(realPath);
        }else if(stats.isFile()){
          var fileParts = file.split('.');
          var ext = fileParts[(fileParts.length - 1)];
          if (ext === 'js')
            api.actions.loadFile(fullFilePath);
        }else{
          api.log(file+" is a type of file I cannot read", "error")
        }
      }
    });
  }

  api.actions.loadFile = function(fullFilePath, reload){
    if(reload == null){ reload = false; }

    var loadMessage = function(action){
      if(reload){
        loadMessage = "action (re)loaded: " + action.name + " @ v" + action.version + ", " + fullFilePath;
      }else{
        var loadMessage = "action loaded: " + action.name + " @ v" + action.version + ", " + fullFilePath;
      }
      api.log(loadMessage, "debug");
    }

    api.watchFileAndAct(fullFilePath, function(){
      var cleanPath;
      if(process.platform === 'win32'){
        cleanPath = fullFilePath.replace(/\//g, "\\");
      } else {
        cleanPath = fullFilePath;
      }

      delete require.cache[require.resolve(cleanPath)];
      api.actions.loadFile(fullFilePath, true);
      api.params.buildPostVariables();
    })

    try{
      var collection = require(fullFilePath);
      for(var i in collection){
        var action = collection[i];
        if(action.version == null){ action.version = 1.0; }
        if(api.actions.actions[action.name] == null){ api.actions.actions[action.name] = {}; }
        api.actions.actions[action.name][action.version] = action;
        if(api.actions.versions[action.name] == null){
          api.actions.versions[action.name] = [];
        }
        api.actions.versions[action.name].push(action.version);
        api.actions.versions[action.name].sort();
        api.actions.validateAction(api.actions.actions[action.name][action.version]);
        loadMessage(action);
      }
    }catch(err){
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
