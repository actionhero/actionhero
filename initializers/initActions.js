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

  api.actionProcessor = function(data){
    if(data.connection == null){ throw new Error('data.connection is required'); }
    this.connection = data.connection;
    this.callback = data.callback;
  }

  api.actionProcessor.prototype.incrementTotalActions = function(count){
    if(count == null){ count = 1; }
    if(this.connection._original_connection != null){
      this.connection._original_connection.totalActions = this.connection._original_connection.totalActions + count;
    }else{
      this.connection.totalActions = this.connection.totalActions + count;
    }
  }

  api.actionProcessor.prototype.incramentPendingActions = function(count){
    if(count == null){ count = 1; }
    if(this.connection._original_connection != null){
      this.connection._original_connection.pendingActions = this.connection._original_connection.pendingActions + count;
    }else{
      this.connection.pendingActions = this.connection.pendingActions + count;
    }
  }

  api.actionProcessor.prototype.getPendingActionCount = function(){
    if(this.connection._original_connection != null){
      return this.connection._original_connection.pendingActions;
    }else{
      return this.connection.pendingActions;
    }
  }

  api.actionProcessor.prototype.completeAction = function(error, toRender){
    var self = this;
    self.connection.respondingTo = self.messageID;
    if(error != null){ self.connection.error = error; }
    if(toRender == null){ toRender = true; }
    self.incramentPendingActions(self.connection, -1);
    process.nextTick(function(){
      if(typeof self.callback == 'function'){
        self.callback(self.connection, toRender);
      }
    });
  }

  api.actionProcessor.prototype.sanitizeLimitAndOffset = function(){
    if(this.connection.params.limit == null){ 
      this.connection.params.limit = api.configData.general.defaultLimit; 
    }else{ 
      this.connection.params.limit = parseFloat(this.connection.params.limit); 
    }
    if(this.connection.params.offset == null){ 
      this.connection.params.offset = api.configData.general.defaultOffset; 
    }else{ 
      this.connection.params.offset = parseFloat(this.connection.params.offset); 
    }
  }

  api.actionProcessor.prototype.processAction = function(messageID){ 
    var self = this;
    self.messageID = messageID;
    self.incrementTotalActions();
    self.incramentPendingActions();
    self.sanitizeLimitAndOffset();

    if(api.running != true){
      self.completeAction("the server is shutting down");
    }else if(self.getPendingActionCount(self.connection) > api.configData.general.simultaniousActions){
      self.completeAction("you have too many pending requests");
    }else{
      if (self.connection.error === null){
        if(self.connection.type == "web"){ api.utils.processRoute(api, self.connection); }
        self.connection.action = self.connection.params["action"];
        if(api.actions[self.connection.action] != undefined){
          api.utils.requiredParamChecker(api, self.connection, api.actions[self.connection.action].inputs.required);
          if(self.connection.error === null){
            process.nextTick(function() { 
              api.stats.increment(api, "actions:processedActions");
              if(api.domain != null){
                var actionDomain = api.domain.create();
                actionDomain.on("error", function(err){
                  self.incramentPendingActions(self.connection, -1);
                  api.exceptionHandlers.action(actionDomain, err, self.connection, self.callback);
                });
                actionDomain.run(function(){
                  api.actions[self.connection.action].run(api, self.connection, function(connection, toRender){
                    self.connection = connection;
                    self.completeAction();
                  }); 
                })
              }else{
                api.actions[self.connection.action].run(api, self.connection, function(connection, toRender){
                  self.connection = connection;
                  self.completeAction();
                }); 
              }
            });
          }else{
            self.completeAction(); 
          }
        }else{
          api.stats.increment(api, "actions:actionsNotFound");
          if(self.connection.action == "" || self.connection.action == null){ self.connection.action = "{no action}"; }
          self.connection.error = new Error(self.connection.action + " is not a known action.");
          if(api.configData.commonWeb.returnErrorCodes == true && self.connection.type == "web"){
            self.connection.responseHttpCode = 404;
          }
          self.completeAction();
        }
      }else{
        self.completeAction();
      }
    }
  }
}

/////////////////////////////////////////////////////////////////////
// exports
exports.initActions = initActions;