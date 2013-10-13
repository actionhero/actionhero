var fs = require('fs');

var actions = function(api, next){
  api.actions = {};
  api.actions.actions = {};
  api.actions.versions = {};

  api.actions.preProcessors = [];
  api.actions.postProcessors = [];

  api.actions.load = function(fullFilePath, reload){
    if(reload == null){ reload = false; }

    var loadMessage = function(action){
      if(reload){
        loadMessage = "action (re)loaded: " + action.name + " @ v" + action.version + ", " + fullFilePath;
      }else{
        var loadMessage = "action loaded: " + action.name + " @ v" + action.version + ", " + fullFilePath;
      }
      api.log(loadMessage, "debug");
    }

    var parts = fullFilePath.split("/");
    var file = parts[(parts.length - 1)];
    var actionName = file.split(".")[0];
    
    if(!reload){
      if(api.configData.general.developmentMode == true){
        api.watchedFiles.push(fullFilePath);
        (function() {
          fs.watchFile(fullFilePath, {interval:1000}, function(curr, prev){
            if(curr.mtime > prev.mtime){
              process.nextTick(function(){
                if(fs.readFileSync(fullFilePath).length > 0){
                  var cleanPath;
                  if(process.platform === 'win32'){
                    cleanPath = fullFilePath.replace(/\//g, "\\");
                  } else {
                    cleanPath = fullFilePath;
                  }

                  delete require.cache[require.resolve(cleanPath)];
                  delete api.actions.actions[actionName];
                  api.actions.load(fullFilePath, true);
                  api.params.buildPostVariables();
                }
              });
            }
          });
        })();
      }
    }

    var loadInAction = function(action){
      if(action.version == null){ action.version = 1.0; }
      if(api.actions.actions[action.name] == null){ api.actions.actions[action.name] = {}; }
      api.actions.actions[action.name][action.version] = action;
      if(api.actions.versions[action.name] == null){
        api.actions.versions[action.name] = [];
      }
      api.actions.versions[action.name].push(action.version);
      api.actions.versions[action.name].sort();
      validateAction(api.actions.actions[action.name][action.version]);
      loadMessage(action);
    }

    try{
      var collection = require(fullFilePath);
      if(api.utils.hashLength(collection) == 1){
        var action = collection.action
        loadInAction(action);
      }else{
        for(var i in collection){
          var action = collection[i];
          loadInAction(action);
        }
      }       
    }catch(err){
      api.exceptionHandlers.loader(fullFilePath, err);
      delete api.actions.actions[action.name][action.version];
    }
  }

  if(api.configData.general.simultaneousActions == null){
    api.configData.general.simultaneousActions = 5;
  }
  
  var validateAction = function(action){
    var fail = function(msg){
      api.log(msg + "; exiting.", "emerg");
      process.exit();
    }

    if(typeof action.name != "string" || action.name.length < 1){
      fail("an action is missing `action.name`");
    }else if(typeof action.description != "string" || action.description.length < 1){
      fail("Action "+action.name+" is missing `action.description`");
    }else if(typeof action.inputs != "object"){
      fail("Action "+action.name+" has no inputs");
    }else if(typeof action.inputs.required != "object"){
      fail("Action "+action.name+" has no required inputs");
    }else if(typeof action.inputs.optional != "object"){
      fail("Action "+action.name+" has no optional inputs");
    }else if(typeof action.outputExample != "object"){
      fail("Action "+action.name+" has no outputExample");
    }else if(typeof action.run != "function"){
      fail("Action "+action.name+" has no run method");
    }else if(api.connections != null && api.connections.allowedVerbs.indexOf(action.name) >= 0){
      fail(action.name+" is a reserved verb for connections. choose a new name");
    }
  }

  fs.exists(api.configData.general.paths.action, function (exists) {
    if(!exists){
      api.log(api.configData.general.paths.action + " defeined as action path, but does not exist", 'warning');
    }else{
      var path = api.configData.general.paths.action;
      fs.readdirSync(path).forEach( function(file) {
        if(path[path.length - 1] != "/"){ path += "/"; } 
        var fullFilePath = path + file;
        if (file[0] != "."){
          var stats = fs.statSync(fullFilePath);
          if(stats.isDirectory()){
            loadFolder(fullFilePath);
          }else if(stats.isSymbolicLink()){
            var realPath = readlinkSync(fullFilePath);
            loadFolder(realPath);
          }else if(stats.isFile()){
            var ext = file.split('.')[1];
            if (ext === 'js')
              api.actions.load(fullFilePath);
          }else{
            api.log(file+" is a type of file I cannot read", "error")
          }
        }
      });
    }

    next();
  });
}

/////////////////////////////////////////////////////////////////////
// exports
exports.actions = actions;
