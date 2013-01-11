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
        if(self.connection.type == "web"){ api.utils.processRoute(self.connection); }
        self.connection.action = self.connection.params["action"];
        if(api.actions[self.connection.action] != undefined){
          api.utils.requiredParamChecker(self.connection, api.actions[self.connection.action].inputs.required);
          if(self.connection.error === null){
            process.nextTick(function() { 
              api.stats.increment("actions:processedActions");
              if(api.domain != null){
                var actionDomain = api.domain.create();
                actionDomain.on("error", function(err){
                  self.incramentPendingActions(-1);
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
          api.stats.increment("actions:actionsNotFound");
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

  next();
}

/////////////////////////////////////////////////////////////////////
// exports
exports.actionProcessor = actionProcessor;