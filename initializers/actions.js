var fs = require('fs');

var actions = function(api, next){
  api.actions = {};
  api.actions.actions = {};

  api.actions.load = function(fullFilePath, reload){
    if(reload == null){ reload = false; }

    var loadMessage = function(loadedActionName){
      if(reload){
        loadMessage = "action (re)loaded: " + loadedActionName + ", " + fullFilePath;
      }else{
        var loadMessage = "action loaded: " + loadedActionName + ", " + fullFilePath;
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
                  delete require.cache[fullFilePath];
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

    try{
      var collection = require(fullFilePath);
      if(api.utils.hashLength(collection) == 1){
        action = require(fullFilePath).action;
        api.actions.actions[action.name] = action;
        validateAction(api.actions.actions[action.name]);
        loadMessage(action.name);
      }else{
        for(var i in collection){
          var action = collection[i];
          api.actions.actions[action.name] = action;
          validateAction(api.actions.actions[action.name]);
          loadMessage(action.name);
        }
      }       
    }catch(err){
      api.exceptionHandlers.loader(fullFilePath, err);
      delete api.actions.actions[actionName];
    }
  }

  if(api.configData.general.simultaniousActions == null){
    api.configData.general.simultaniousActions = 5;
  }
  
  var validateAction = function(action){
    var fail = function(msg){
      api.log(msg + "; exiting.", emerg);
      process.exit();
    }

    if(typeof action.name != "string" && action.name.length < 1){
      fail("an action is missing `action.name`");
    }else if(typeof action.description != "string" && action.name.description < 1){
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
    }
  }

  var actionsPath = process.cwd() + "/actions/";
  fs.exists(actionsPath, function (exists) {
    if(!exists){
      var defaultActionsPath = process.cwd() + "/node_modules/actionHero/actions/";
      api.log("no ./actions path in project, loading defaults from "+defaultActionsPath, "warning");
      actionsPath = defaultActionsPath;
    }

    function loadFolder(path){
      if(fs.existsSync(path)){
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
              api.actions.load(fullFilePath);
            }else{
              api.log(file+" is a type of file I cannot read", "error")
            }
          }
        });
      }else{
        api.log("ao actions folder found", "warning");
      }
    }

    loadFolder(actionsPath);
    
    next();
  });
}

/////////////////////////////////////////////////////////////////////
// exports
exports.actions = actions;