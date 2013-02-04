var actionProcessor = function(api, next){

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
    self.incramentPendingActions(-1);
    api.stats.increment("actions:actionsCurrentlyProcessing", -1);
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
    self.connection.action = self.connection.params["action"];
    var actionTemplate = api.actions.actions[self.connection.action];

    api.stats.increment("actions:actionsCurrentlyProcessing");

    if(self.connection.type == "web"){ api.routes.processRoute(self.connection); }

    if(api.running != true){
      self.completeAction("the server is shutting down");
    }else if(self.getPendingActionCount(self.connection) > api.configData.general.simultaniousActions){
      self.completeAction("you have too many pending requests");
    }else if(self.connection.error !== null){
      self.completeAction();
    }else if(self.connection.action == null || actionTemplate == null){
      api.stats.increment("actions:actionsNotFound");
      if(self.connection.action == "" || self.connection.action == null){ self.connection.action = "{no action}"; }
      self.connection.error = new Error(self.connection.action + " is not a known action.");
      if(api.configData.commonWeb.returnErrorCodes == true && self.connection.type == "web"){
        self.connection.responseHttpCode = 404;
      }
      self.completeAction();
    }else if(actionTemplate.blockedConnectionTypes != null && actionTemplate.blockedConnectionTypes.indexOf(self.connection.type) >= 0 ){
      self.connection.error = new Error("this action does not support the " + self.connection.type + "connection type");
      self.completeAction();
    }else{
      api.params.requiredParamChecker(self.connection, actionTemplate.inputs.required);
      if(self.connection.error === null){
        process.nextTick(function() { 
          api.stats.increment("actions:totalProcessedActions");
          api.stats.increment("actions:processedActions:" + self.connection.action);
          if(api.domain != null){
            var actionDomain = api.domain.create();
            actionDomain.on("error", function(err){
              self.incramentPendingActions(-1);
              api.exceptionHandlers.action(actionDomain, err, self.connection, self.callback);
            });
            actionDomain.run(function(){
              actionTemplate.run(api, self.connection, function(connection, toRender){
                self.connection = connection;
                // actionDomain.dispose();
                self.completeAction(null, toRender);
              }); 
            })
          }else{
            actionTemplate.run(api, self.connection, function(connection, toRender){
              self.connection = connection;
              self.completeAction(null, toRender);
            }); 
          }
        });
      }else{
        self.completeAction(); 
      }
    }
  }

  next();
}

/////////////////////////////////////////////////////////////////////
// exports
exports.actionProcessor = actionProcessor;