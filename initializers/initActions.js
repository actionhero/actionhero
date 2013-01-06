////////////////////////////////////////////////////////////////////////////
// populate actions

var initActions = function(api, next)
{
  api.actions = {};

  if(api.configData.general.simultaniousActions == null){
    api.configData.general.simultaniousActions = 5;
  }
  
  var validateAction = function(api, action){
    var fail = function(msg){
      api.log(msg + "; exiting.", ['red', 'bold']);
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
  api.fs.exists(actionsPath, function (exists) {
    if(!exists){
      var defaultActionsPath = process.cwd() + "/node_modules/actionHero/actions/";
      api.log("no ./actions path in project, loading defaults from "+defaultActionsPath, "yellow");
      actionsPath = defaultActionsPath;
    }

    function loadFolder(path){
      if(api.fs.existsSync(path)){
        api.fs.readdirSync(path).forEach( function(file) {
          if(path[path.length - 1] != "/"){ path += "/"; } 
          var fullFilePath = path + file;
          if (file[0] != "."){
            var stats = api.fs.statSync(fullFilePath);
            if(stats.isDirectory()){
              loadFolder(fullFilePath);
            }else if(stats.isSymbolicLink()){
              var realPath = readlinkSync(fullFilePath);
              loadFolder(realPath);
            }else if(stats.isFile()){
              actionLoader(api, fullFilePath);
            }else{
              api.log(file+" is a type of file I cannot read", "red")
            }
          }
        });
      }else{
        api.log("No actions folder found, skipping...");
      }
    }

    function actionLoader(api, fullFilePath, reload){
      if(reload == null){ reload = false; }

      var loadMessage = function(loadedActionName){
        if(reload){
          loadMessage = "action (re)loaded: " + loadedActionName + ", " + fullFilePath;
        }else{
          var loadMessage = "action loaded: " + loadedActionName + ", " + fullFilePath;
        }
        api.log(loadMessage, "blue");
      }

      var parts = fullFilePath.split("/");
      var file = parts[(parts.length - 1)];
      var actionName = file.split(".")[0];
      
      if(!reload){
        if(api.configData.general.developmentMode == true){
          api.watchedFiles.push(fullFilePath);
          (function() {
            api.fs.watchFile(fullFilePath, {interval:1000}, function(curr, prev){
              if(curr.mtime > prev.mtime){
                process.nextTick(function(){
                  if(api.fs.readFileSync(fullFilePath).length > 0){
                    delete require.cache[fullFilePath];
                    delete api.actions[actionName];
                    actionLoader(api, fullFilePath, true);
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
          api.actions[actionName] = require(fullFilePath).action;
          validateAction(api, api.actions[actionName]);
          loadMessage(actionName);
        }else{
          for(var i in collection){
            var action = collection[i];
            api.actions[action.name] = action;
            validateAction(api, api.actions[action.name]);
            loadMessage(action.name);
          }
        }       
      }catch(err){
        api.exceptionHandlers.loader(fullFilePath, err);
        delete api.actions[actionName];
      }
    }

    loadFolder(actionsPath);
    
    next();
  });

  var incrementTotalActions = function(connection, count){
    if(count == null){ count = 1; }
    if(connection._original_connection != null){
      connection._original_connection.totalActions = connection._original_connection.totalActions + count;
    }else{
      connection.totalActions = connection.totalActions + count;
    }
  }

  var incramentPendingActions = function(connection, count){
    if(count == null){ count = 1; }
    if(connection._original_connection != null){
      connection._original_connection.pendingActions = connection._original_connection.pendingActions + count;
    }else{
      connection.pendingActions = connection.pendingActions + count;
    }
  }

  var getPendingActionCount = function(connection){
    if(connection._original_connection != null){
      return connection._original_connection.pendingActions;
    }else{
      return connection.pendingActions;
    }
  }
  
  api.processAction = function(api, connection, messageID, next){ 
    incrementTotalActions(connection);
    incramentPendingActions(connection);

    if(api.running != true){
      connection.error = "the server is shutting down";
      next(connection, true);
    }else if(getPendingActionCount(connection) > api.configData.general.simultaniousActions){
      incrementTotalActions(connection, -1);
      incramentPendingActions(connection, -1);
      connection.error = "you have too many pending requests";
      next(connection, true);
    }else{
      if(connection.params.limit == null){ 
        connection.params.limit = api.configData.general.defaultLimit; 
      }else{ 
        connection.params.limit = parseFloat(connection.params.limit); 
      }

      if(connection.params.offset == null){ 
        connection.params.offset = api.configData.general.defaultOffset; 
      }else{ 
        connection.params.offset = parseFloat(connection.params.offset); 
      }
      
      if (connection.error === null){
        if(connection.type == "web"){ api.utils.processRoute(api, connection); }
        connection.action = connection.params["action"];
        if(api.actions[connection.action] != undefined){
          var actionProtocols = api.actions[connection.action].protocols;
          var connType = connection.type ? connection.type : '';
          var protocolMatched = false;

          if (actionProtocols != null){
            if (actionProtocols instanceof Array)
              for (var i = 0, l = actionProtocols.length; i < l; i++) {
                if (connType === actionProtocols[i]){
                  protocolMatched = true;
                  break;
                }
              }
            else
              protocolMatched = actionProtocols === connType;
          } else
            protocolMatched = true;
          
          if (!protocolMatched){
            connection.error = new Error(connection.action + " does not support " + connType+ " protocol.");
            if(api.configData.commonWeb.returnErrorCodes == true && connection.type == "web"){
              connection.responseHttpCode = 404;
            }
            process.nextTick(function(){ 
              connection.respondingTo = messageID;
              incramentPendingActions(connection, -1);
              next(connection, true); 
            });            
          }
          else {
            api.utils.requiredParamChecker(api, connection, api.actions[connection.action].inputs.required);
            if(connection.error === null){
              process.nextTick(function() { 
                if(api.domain != null){
                  var actionDomain = api.domain.create();
                  actionDomain.on("error", function(err){
                    incramentPendingActions(connection, -1);
                    api.exceptionHandlers.action(actionDomain, err, connection, next);
                  });
                  actionDomain.run(function(){
                    api.actions[connection.action].run(api, connection, function(connection, toRender){
                      connection.respondingTo = messageID;
                      // actionDomain.dispose();
                      incramentPendingActions(connection, -1);
                      next(connection, toRender);
                    }); 
                  })
                }else{
                  api.actions[connection.action].run(api, connection, function(connection, toRender){
                    connection.respondingTo = messageID;
                    incramentPendingActions(connection, -1);
                    next(connection, toRender);
                  }); 
                }
              });
            }else{
              process.nextTick(function() { 
                connection.respondingTo = messageID;
                incramentPendingActions(connection, -1);
                next(connection, true);  
              });
            }
          }
        }else{
          if(connection.action == "" || connection.action == null){ connection.action = "{no action}"; }
          connection.error = new Error(connection.action + " is not a known action.");
          if(api.configData.commonWeb.returnErrorCodes == true && connection.type == "web"){
            connection.responseHttpCode = 404;
          }
          process.nextTick(function(){ 
            connection.respondingTo = messageID;
            incramentPendingActions(connection, -1);
            next(connection, true); 
          });
        }
      }else{
        process.nextTick(function(){ 
          connection.respondingTo = messageID;
          incramentPendingActions(connection, -1);
          next(connection, true); 
        });
      }
    }
  }
}

/////////////////////////////////////////////////////////////////////
// exports
exports.initActions = initActions;