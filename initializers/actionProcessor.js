var domain = require('domain');
var async = require('async');

var actionProcessor = function(api, next){

  api.actionProcessor = function(data){
    if(null === data.connection){ throw new Error('data.connection is required') }
    this.connection = this.buildProxyConnection(data.connection);
    this.messageCount = this.connection.messageCount
    this.callback = data.callback;
  }

  api.actionProcessor.prototype.buildProxyConnection = function(connection){
    var proxyConnection = {};
    for(var i in connection){
      if(connection.hasOwnProperty(i)){
        proxyConnection[i] = connection[i];
      }
    }
    proxyConnection._original_connection = connection
    return proxyConnection;
  }

  api.actionProcessor.prototype.incrementTotalActions = function(count){
    if(null === count){ count = 1 }
    this.connection._original_connection.totalActions = this.connection._original_connection.totalActions + count;
  }

  api.actionProcessor.prototype.incrementPendingActions = function(count){
    if(null === count){ count = 1 }
    this.connection._original_connection.pendingActions = this.connection._original_connection.pendingActions + count;
  }

  api.actionProcessor.prototype.getPendingActionCount = function(){
    return this.connection._original_connection.pendingActions;
  }

  api.actionProcessor.prototype.completeAction = function(error, toRender){
    var self = this;
    if(null !== error){ self.connection.error = error }
    if(self.connection.error instanceof Error){
      self.connection.error = String(self.connection.error);
    }
    if(null !== self.connection.error && null === self.connection.response.error ){
      self.connection.response.error = self.connection.error;
    }
    if(null === toRender){ toRender = true }
    self.incrementPendingActions(-1);
    api.stats.increment('actions:actionsCurrentlyProcessing', -1);
    self.duration = new Date().getTime() - self.actionStartTime;

    process.nextTick(function(){

      self.connection._original_connection.action = self.connection.action;
      self.connection._original_connection.error = self.connection.error;
      self.connection._original_connection.response = self.connection.response || {};

      if('function' === typeof self.callback){
        self.callback(self.connection._original_connection, toRender, self.messageCount);
      }

      var logLevel = 'info';
      if(null !== self.actionTemplate && null !== self.actionTemplate.logLevel){
        logLevel = self.actionTemplate.logLevel;
      }
      var stringifiedError = ''
      try {
        stringifiedError = JSON.stringify(self.connection.error);
      } catch(e){
        stringifiedError = String(self.connection.error)
      }
      
      api.log('[ action @ ' + self.connection.type + ' ]', logLevel, {
        to: self.connection.remoteIP,
        action: self.connection.action,
        params: JSON.stringify(self.connection.params),
        duration: self.duration,
        error: stringifiedError
      });

    });
  }

  api.actionProcessor.prototype.sanitizeLimitAndOffset = function(){
    if(null === this.connection.params.limit){
      this.connection.params.limit = api.config.general.defaultLimit;
    } else {
      this.connection.params.limit = parseFloat(this.connection.params.limit);
    }
    if(null === this.connection.params.offset){
      this.connection.params.offset = api.config.general.defaultOffset;
    } else {
      this.connection.params.offset = parseFloat(this.connection.params.offset);
    }
    if(null !== this.connection.params.apiVersion){
      this.connection.params.apiVersion = parseFloat(this.connection.params.apiVersion);
      if(isNaN(this.connection.params.apiVersion)){ this.connection.params.apiVersion = null; }
    }
  }

  api.actionProcessor.prototype.preProcessAction = function(toProcess, callback){
    var self = this;
    if(0 === api.actions.preProcessors.length){
      callback(toProcess);
    } else {
      var processors = [];
      api.actions.preProcessors.forEach(function(processor){
        processors.push(function(next){
          if(true === toProcess){
            processor(self.connection, self.actionTemplate, function(connection, localToProcess){
              self.connection = connection
              toProcess = localToProcess
              next();
            });
          } else { next(toProcess) }
        })
      });
      processors.push(function(){ callback(toProcess) });
      async.series(processors);
    }
  }

  api.actionProcessor.prototype.postProcessAction = function(toRender, callback){
    var self = this;
    if(0 === api.actions.postProcessors.length){
      callback(toRender);
    } else {
      var processors = [];
      api.actions.postProcessors.forEach(function(processor){
        processors.push(function(next){
          processor(self.connection, self.actionTemplate, toRender, function(connection, localToRender){
            self.connection = connection;
            toRender = localToRender;
            next();
          });
        })
      });
      processors.push(function(){ callback(toRender) });
      async.series(processors);
    }
  }

  api.actionProcessor.prototype.reduceParams = function(){
    var self = this;
    for(var p in self.connection.params){
      if(api.params.globalSafeParams.indexOf(p) < 0 &&
         self.actionTemplate.inputs.required.indexOf(p) < 0 &&
         self.actionTemplate.inputs.optional.indexOf(p) < 0
      ){
        delete self.connection.params[p];
      }
    }
  }

  api.actionProcessor.prototype.processAction = function(){
    var self = this;
    self.actionStartTime = new Date().getTime();
    self.incrementTotalActions();
    self.incrementPendingActions();
    self.sanitizeLimitAndOffset();

    self.connection.action = self.connection.params['action'];
    if(null !== api.actions.versions[self.connection.action]){
      if(null === self.connection.params.apiVersion){
        self.connection.params.apiVersion = api.actions.versions[self.connection.action][api.actions.versions[self.connection.action].length - 1];
      }
      self.actionTemplate = api.actions.actions[self.connection.action][self.connection.params.apiVersion];
    }
    api.stats.increment('actions:actionsCurrentlyProcessing');

    if(true !== api.running){
      self.completeAction('the server is shutting down');
    } else if(self.getPendingActionCount(self.connection) > api.config.general.simultaneousActions){
      self.completeAction('you have too many pending requests');
    } else if(null !== self.connection.error){
      self.completeAction();
    } else if(null === self.connection.action || null === self.actionTemplate){
      api.stats.increment('actions:actionsNotFound');
      if(null === self.connection.action || '' === self.connection.action){ self.connection.action = '{no action}' }
      self.connection.error = new Error(self.connection.action + ' is not a known action or that is not a valid apiVersion.');
      self.completeAction();
    } else if(null !== self.actionTemplate.blockedConnectionTypes && self.actionTemplate.blockedConnectionTypes.indexOf(self.connection.type) >= 0){
      self.connection.error = new Error('this action does not support the ' + self.connection.type + ' connection type');
      self.completeAction();
    } else {
      self.reduceParams();
      api.params.requiredParamChecker(self.connection, self.actionTemplate.inputs.required);
      if(self.connection.error === null){
        process.nextTick(function(){
          api.stats.increment('actions:totalProcessedActions');
          api.stats.increment('actions:processedActions:' + self.connection.action);
          var actionDomain = domain.create();
          actionDomain.on('error', function(err){
            api.exceptionHandlers.action(actionDomain, err, self.connection, function(){
              self.completeAction(null, true);
            });
          });
          actionDomain.run(function(){
            var toProcess = true;
            self.preProcessAction(toProcess, function(toProcess){
              if(true === toProcess){
                self.actionTemplate.run(api, self.connection, function(connection, toRender){
                  self.connection = connection;
                  // actionDomain.dispose();
                  self.postProcessAction(toRender, function(toRender){
                    self.completeAction(null, toRender);
                  });
                });
              } else {
                self.completeAction(null, true);
              }
            });
          });
        });
      } else {
        self.completeAction();
      }
    }
  }

  next();
}

/////////////////////////////////////////////////////////////////////
// exports
exports.actionProcessor = actionProcessor;
