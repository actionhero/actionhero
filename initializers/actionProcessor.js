var domain = require("domain");

var actionProcessor = function(api, next){

  api.actionProcessor = function(data){
    if(data.connection == null){ throw new Error('data.connection is required'); }
    this.connection = this.buildProxyConnection(data.connection);
    this.callback = data.callback;
  }

  api.actionProcessor.prototype.buildProxyConnection = function(connection){
    var proxyConnection = {};
    for (var i in connection) {
      if (connection.hasOwnProperty(i)) {
        proxyConnection[i] = connection[i];
      }
    }
    proxyConnection._original_connection = connection
    return proxyConnection;
  }

  api.actionProcessor.prototype.incrementTotalActions = function(count){
    if(count == null){ count = 1; }
    this.connection._original_connection.totalActions = this.connection._original_connection.totalActions + count;
  }

  api.actionProcessor.prototype.incramentPendingActions = function(count){
    if(count == null){ count = 1; }
    this.connection._original_connection.pendingActions = this.connection._original_connection.pendingActions + count;
  }

  api.actionProcessor.prototype.getPendingActionCount = function(){
    return this.connection._original_connection.pendingActions;
  }

  api.actionProcessor.prototype.completeAction = function(error, toRender){
    var self = this;
    if(error != null){ self.connection.error = error; }
    if(self.connection.error != null && self.connection.response.error == null ){ 
      self.connection.response.error = String(self.connection.error); 
    }
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

  api.actionProcessor.prototype.preProcessAction = function(api, connection, actionTemplate, callback){
    // You probably want to overwite me and make your own `preProcessAction`
    callback(true);
  }

  api.actionProcessor.prototype.processAction = function(){ 
    var self = this;
    self.incrementTotalActions();
    self.incramentPendingActions();
    self.sanitizeLimitAndOffset();

    self.connection.action = self.connection.params["action"];
    var actionTemplate = api.actions.actions[self.connection.action];
    api.stats.increment("actions:actionsCurrentlyProcessing");

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
      self.completeAction();
    }else if(actionTemplate.blockedConnectionTypes != null && actionTemplate.blockedConnectionTypes.indexOf(self.connection.type) >= 0 ){
      self.connection.error = new Error("this action does not support the " + self.connection.type + " connection type");
      self.completeAction();
    }else{
      api.params.requiredParamChecker(self.connection, actionTemplate.inputs.required);
      if(self.connection.error === null){
        process.nextTick(function() { 
          api.stats.increment("actions:totalProcessedActions");
          api.stats.increment("actions:processedActions:" + self.connection.action);
          var actionDomain = domain.create();
          actionDomain.on("error", function(err){
            api.exceptionHandlers.action(actionDomain, err, self.connection, function(){
              self.completeAction(null, true);
            });
          });
          actionDomain.run(function(){
            self.preProcessAction(api, self.connection, actionTemplate, function(toContinue){
              if(toContinue === true){
                actionTemplate.run(api, self.connection, function(connection, toRender){
                  self.connection = connection;
                  // actionDomain.dispose();
                  self.completeAction(null, toRender);
                }); 
              }else{
                self.completeAction(null, true);
              }
            });
          });
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