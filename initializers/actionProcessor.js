var domain = require('domain');
var async = require('async');

module.exports = {
  loadPriority:  430,
  initialize: function(api, next){

    var duplicateCallbackErrorTimeout = 500;
    
    api.actionProcessor = function(data){
      if(!data.connection){ throw new Error('data.connection is required') }
      this.connection = this.buildProxyConnection(data.connection);
      this.messageCount = this.connection.messageCount
      this.callback = data.callback;
      this.missingParams = [];
      this.validatorErrors = [];
      this.working = false;
    }

    api.actionProcessor.prototype.buildProxyConnection = function(connection){
      var proxyConnection = {};
      for(var i in connection){
        if(connection.hasOwnProperty(i)){
          proxyConnection[i] = connection[i];
        }
      }
      proxyConnection._originalConnection = connection
      return proxyConnection;
    }

    api.actionProcessor.prototype.incrementTotalActions = function(count){
      if(!count){ count = 1 }
      this.connection._originalConnection.totalActions = this.connection._originalConnection.totalActions + count;
    }

    api.actionProcessor.prototype.incrementPendingActions = function(count){
      if(!count){ count = 1 }
      this.connection._originalConnection.pendingActions = this.connection._originalConnection.pendingActions + count;
    }

    api.actionProcessor.prototype.getPendingActionCount = function(){
      return this.connection._originalConnection.pendingActions;
    }

    api.actionProcessor.prototype.completeAction = function(status, toRender, actionDomain){
      var self = this;
      if(actionDomain){ actionDomain.exit(); }
      var error = null

      if(status === 'server_shutting_down'){
        error = api.config.errors.serverShuttingDown();
      }else if(status === 'too_many_requests'){
        error = api.config.errors.tooManyPendingActions();
      }else if(status === 'unknown_action'){
        error = api.config.errors.unknownAction(self.connection.action);
      }else if(status === 'unsupported_server_type'){
        error = api.config.errors.unsupportedServerType(self.connection.type);
      }else if(status === 'missing_params'){
        error = api.config.errors.missingParams(self.missingParams) ;
      }else if(status === 'validator_errors'){
        error = self.validatorErrors.join(', ') ;
      }

      if(error !== null){
        if(typeof error === 'string') self.connection.error = new Error( error );
        else self.connection.error = error;
      }
      if(self.connection.error instanceof Error){
        self.connection.error = String(self.connection.error);
      }
      if(self.connection.error && !self.connection.response.error){
        self.connection.response.error = self.connection.error;
      }

      if(toRender === null || toRender === undefined){ toRender = true; }
      self.incrementPendingActions(-1);
      api.stats.increment('actions:actionsCurrentlyProcessing', -1);
      self.duration = new Date().getTime() - self.actionStartTime;

      process.nextTick(function(){
        self.connection._originalConnection.action = self.connection.action;
        self.connection._originalConnection.actionStatus = status;
        self.connection._originalConnection.error = self.connection.error;
        self.connection._originalConnection.response = self.connection.response || {};

        if(typeof self.callback === 'function'){
          self.callback(self.connection._originalConnection, toRender, self.messageCount);
        }
      });

      var logLevel = 'info';
      if(self.actionTemplate && self.actionTemplate.logLevel){
        logLevel = self.actionTemplate.logLevel;
      }
      var stringifiedError = '';
      try {
        stringifiedError = JSON.stringify(self.connection.error);
      } catch(e){
        stringifiedError = String(self.connection.error)
      }
      
      var filteredParams = {}
      for(var i in self.connection.params){
        if(api.config.general.filteredParams && api.config.general.filteredParams.indexOf(i) >= 0){
          filteredParams[i] = '[FILTERED]';
        }else{
          filteredParams[i] = self.connection.params[i];
        }
      }

      api.log('[ action @ ' + self.connection.type + ' ]', logLevel, {
        to: self.connection.remoteIP,
        action: self.connection.action,
        params: JSON.stringify(filteredParams),
        duration: self.duration,
        error: stringifiedError
      });

      self.working = false;
    }
    
    api.actionProcessor.prototype.preProcessAction = function(toProcess, callback){
      var self = this;
      var priorities = [];
      var processors = [];
      for(var p in api.actions.preProcessors) priorities.push(p);
      priorities.sort();

      if(priorities.length === 0) return callback(toProcess);

      priorities.forEach(function(priority){
        api.actions.preProcessors[priority].forEach(function(processor){
          processors.push(function(next){
            if(toProcess === true){
              processor(self.connection, self.actionTemplate, function(connection, localToProcess){
                self.connection = connection;
                if(localToProcess !== null){ toProcess = localToProcess; }
                next();
              });
            } else { next(toProcess) }
          });
        });
      });

      processors.push(function(){ callback(toProcess) });
      async.series(processors);
    }
    
    api.actionProcessor.prototype.postProcessAction = function(toRender, callback){
      var self = this;
      var priorities = [];
      var processors = [];
      for(var p in api.actions.postProcessors) priorities.push(p);
      priorities.sort();

      if(priorities.length === 0) return callback(toRender);

      priorities.forEach(function(priority){
        api.actions.postProcessors[priority].forEach(function(processor){
          processors.push(function(next){
            processor(self.connection, self.actionTemplate, toRender, function(connection, localToRender){
              self.connection = connection;
              if(localToRender !== null){ toRender = localToRender; }
              next();
            });
          });
        });
      });

      processors.push(function(){ callback(toRender) });
      async.series(processors);
    }

    api.actionProcessor.prototype.reduceParams = function(){
      var self = this;
      if(api.config.general.disableParamScrubbing !== true){
        for(var p in self.connection.params){
          if(
              api.params.postVariables.indexOf(p) < 0 &&
              Object.keys(self.actionTemplate.inputs).indexOf(p) < 0
          ){
            delete self.connection.params[p];
          }
        }
      }
    }

    api.actionProcessor.prototype.validateParams = function(){
      var self = this;
      for(var key in self.actionTemplate.inputs){
        var props = self.actionTemplate.inputs[key];
        
        // default
        if(self.connection.params[key] === undefined && props.default !== undefined){
          if(typeof props.default === 'function'){
            self.connection.params[key] = props.default(self.connection.params[key], self.connection, self.actionTemplate);
          }else{
            self.connection.params[key] = props.default;
          }
        }

        // formatter
        if(self.connection.params[key] !== undefined && typeof props.formatter === 'function'){
          self.connection.params[key] = props.formatter(self.connection.params[key], self.connection, self.actionTemplate);
        }

        // validator
        if(self.connection.params[key] !== undefined && typeof props.validator === 'function'){
          var validatorResponse = props.validator(self.connection.params[key], self.connection, self.actionTemplate);
          if(validatorResponse !== true){
            self.validatorErrors.push(validatorResponse);
          }
        }

        // required
        if(props.required === true){
          if( api.config.general.missingParamChecks.indexOf(self.connection.params[key]) >= 0){
            self.missingParams.push(key);
          }
        }
      }
    }

    api.actionProcessor.prototype.duplicateCallbackHandler = function(actionDomain){
      var self = this;
      if(self.working === true){
        setTimeout(function(){
          self.duplicateCallbackHandler(actionDomain);
        }, duplicateCallbackErrorTimeout)
      }else{
        process.nextTick(function(){
          api.exceptionHandlers.action(actionDomain, new Error( api.config.errors.doubleCallbackError() ), self.connection);
        });
      }
    }

    api.actionProcessor.prototype.processAction = function(){
      var self = this;
      self.actionStartTime = new Date().getTime();
      self.working = true;
      self.incrementTotalActions();
      self.incrementPendingActions();

      self.connection.action = self.connection.params.action;
      if(api.actions.versions[self.connection.action]){
        if(!self.connection.params.apiVersion){
          self.connection.params.apiVersion = api.actions.versions[self.connection.action][api.actions.versions[self.connection.action].length - 1];
        }
        self.actionTemplate = api.actions.actions[self.connection.action][self.connection.params.apiVersion];
      }
      api.stats.increment('actions:actionsCurrentlyProcessing');

      if(api.running !== true){
        self.completeAction('server_shutting_down');
      } else if(self.getPendingActionCount(self.connection) > api.config.general.simultaneousActions){
        self.completeAction('too_many_requests');
      } else if(self.connection.error !== null){
        self.completeAction(false);
      } else if(!self.connection.action || !self.actionTemplate){
        api.stats.increment('actions:actionsNotFound');
        if(self.connection.action === '' || !self.connection.action){ self.connection.action = '{no action}'; }
        self.completeAction('unknown_action');
      } else if(self.actionTemplate.blockedConnectionTypes && self.actionTemplate.blockedConnectionTypes.indexOf(self.connection.type) >= 0){
        self.completeAction('unsupported_server_type');
      } else {
        api.stats.increment('actions:totalProcessedActions');
        api.stats.increment('actions:processedActions:' + self.connection.action);
        
        if(api.config.general.actionDomains === true){
          var actionDomain = domain.create();
          actionDomain.on('error', function(err){
            api.exceptionHandlers.action(actionDomain, err, self.connection, function(){
              self.completeAction('server_error', true, actionDomain);
            });
          });
          actionDomain.run(function(){
            self.runAction();
          });
        }else{
          self.runAction();
        }

      }
    }

    api.actionProcessor.prototype.runAction = function(actionDomain){
      var self = this;
      var toProcess = true;
      var callbackCount = 0;
      self.preProcessAction(toProcess, function(toProcess){
        
        self.reduceParams();
        self.validateParams();

        if(self.missingParams.length > 0){
          self.completeAction('missing_params');
        }else if(self.validatorErrors.length > 0){
          self.completeAction('validator_errors');
        }else if(toProcess === true && self.connection.error === null){
          self.actionTemplate.run(api, self.connection, function(connection, toRender){
            callbackCount++;
            if(callbackCount !== 1){ 
              callbackCount = 1; 
              self.duplicateCallbackHandler(actionDomain); 
            }else{
              self.connection = connection;
              self.postProcessAction(toRender, function(toRender){
                self.completeAction(true, toRender, actionDomain);
              });
            }
          });
        }else{
          self.completeAction(false, true, actionDomain);
        }
      });
    }

    next();
  }
}