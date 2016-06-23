'use strict';

var async = require('async');

module.exports = {
  loadPriority:  430,
  initialize: function(api, next){

    var prepareStringMethod = function(method){
      var cmdParts = method.split('.');
      var cmd = cmdParts.shift();
      if(cmd !== 'api'){ throw new Error('cannot operate on a method outside of the api object'); }
      return api.utils.stringToHash(cmdParts.join('.'));
    };

    api.actionProcessor = function(connection, callback){
      if(!connection){
        throw new Error('data.connection is required');
      }

      this.connection      = connection;
      this.action          = null;
      this.toProcess       = true;
      this.toRender        = true;
      this.messageCount    = connection.messageCount;
      this.params          = connection.params;
      this.callback        = callback;
      this.missingParams   = [];
      this.validatorErrors = [];
      this.actionStartTime = null;
      this.actionTemplate  = null;
      this.working         = false;
      this.response        = {};
      this.duration        = null;
      this.actionStatus    = null;
    };

    api.actionProcessor.prototype.incrementTotalActions = function(count){
      var self = this;
      if(!count){ count = 1; }
      self.connection.totalActions = self.connection.totalActions + count;
    };

    api.actionProcessor.prototype.incrementPendingActions = function(count){
      var self = this;
      if(!count){ count = 1; }
      self.connection.pendingActions = self.connection.pendingActions + count;
    };

    api.actionProcessor.prototype.getPendingActionCount = function(){
      var self = this;
      return self.connection.pendingActions;
    };

    api.actionProcessor.prototype.completeAction = function(status){
      var self = this;
      var error = null;
      self.actionStatus = String(status);

      if(status instanceof Error){
        error = status;
      }else if(status === 'server_shutting_down'){
        error = api.config.errors.serverShuttingDown(self);
      }else if(status === 'too_many_requests'){
        error = api.config.errors.tooManyPendingActions(self);
      }else if(status === 'unknown_action'){
        error = api.config.errors.unknownAction(self);
      }else if(status === 'unsupported_server_type'){
        error = api.config.errors.unsupportedServerType(self);
      }else if(status === 'missing_params'){
        error = api.config.errors.missingParams(self, self.missingParams);
      }else if(status === 'validator_errors'){
        error = api.config.errors.invalidParams(self, self.validatorErrors);
      }else if(status){
        error = status;
      }

      if(error && typeof error === 'string'){
        error = new Error(error);
      }
      if(error && !self.response.error){
        self.response.error = error;
      }

      self.incrementPendingActions(-1);
      self.duration = new Date().getTime() - self.actionStartTime;

      process.nextTick(function(){
        if(typeof self.callback === 'function'){
          self.callback(self);
        }
      });

      self.working = false;
      self.logAction(error);
    };

    api.actionProcessor.prototype.logAction = function(error){
      var self = this;

      // logging
      var logLevel = 'info';
      if(self.actionTemplate && self.actionTemplate.logLevel){
        logLevel = self.actionTemplate.logLevel;
      }

      var filteredParams = {};
      for(var i in self.params){
        if(api.config.general.filteredParams && api.config.general.filteredParams.indexOf(i) >= 0){
          filteredParams[i] = '[FILTERED]';
        }else if(typeof self.params[i] === 'string'){
          filteredParams[i] = self.params[i].substring(0, api.config.logger.maxLogStringLength);
        }else{
          filteredParams[i] = self.params[i];
        }
      }

      var logLine = {
        to: self.connection.remoteIP,
        action: self.action,
        params: JSON.stringify(filteredParams),
        duration: self.duration,
      };

      if(error){
        if(error instanceof Error){
          logLine.error = String(error);
        }else{
          try{
            logLine.error = JSON.stringify(error);
          }catch(e){
            logLine.error = String(error);
          }
        }
      }

      api.log(['[ action @ %s ]', self.connection.type], logLevel, logLine);
    };

    api.actionProcessor.prototype.preProcessAction = function(callback){
      var self = this;
      var processors     = [];
      var processorNames = api.actions.globalMiddleware.slice(0);

      if(self.actionTemplate.middleware){
        self.actionTemplate.middleware.forEach(function(m){ processorNames.push(m); });
      }

      processorNames.forEach(function(name){
        if(typeof api.actions.middleware[name].preProcessor === 'function'){
          processors.push(function(next){ api.actions.middleware[name].preProcessor(self, next); });
        }
      });

      async.series(processors, callback);
    };

    api.actionProcessor.prototype.postProcessAction = function(callback){
      var self = this;
      var processors     = [];
      var processorNames = api.actions.globalMiddleware.slice(0);

      if(self.actionTemplate.middleware){
        self.actionTemplate.middleware.forEach(function(m){ processorNames.push(m); });
      }

      processorNames.forEach(function(name){
        if(typeof api.actions.middleware[name].postProcessor === 'function'){
          processors.push(function(next){ api.actions.middleware[name].postProcessor(self, next); });
        }
      });

      async.series(processors, callback);
    };

    api.actionProcessor.prototype.reduceParams = function(){
      var self = this;
      var inputNames = [];
      if(self.actionTemplate.inputs){
        inputNames = Object.keys(self.actionTemplate.inputs);
      }

      if(api.config.general.disableParamScrubbing !== true){
        for(var p in self.params){
          if(api.params.globalSafeParams.indexOf(p) < 0 && inputNames.indexOf(p) < 0){
            delete self.params[p];
          }
        }
      }
    };

    api.actionProcessor.prototype.validateParams = function(){
      var self = this;

      for(var key in self.actionTemplate.inputs){
        var props = self.actionTemplate.inputs[key];

        // default
        if(self.params[key] === undefined && props['default'] !== undefined){
          if(typeof props['default'] === 'function'){
            self.params[key] = props['default'].call(api, self.params[key], self);
          }else{
            self.params[key] = props['default'];
          }
        }

        // formatter
        if(self.params[key] !== undefined && props.formatter !== undefined){
          if(!Array.isArray(props.formatter)){ props.formatter = [props.formatter]; }

          props.formatter.forEach(function(formatter){
            if(typeof formatter === 'function'){
              self.params[key] = formatter.call(api, self.params[key], self);
            }else{
              var method = prepareStringMethod(formatter);
              self.params[key] = method.call(api, self.params[key], self);
            }
          });
        }

        // validator
        if(self.params[key] !== undefined && props.validator !== undefined){
          if(!Array.isArray(props.validator)){ props.validator = [props.validator]; }

          props.validator.forEach(function(validator){
            var validatorResponse;
            if(typeof validator === 'function'){
              validatorResponse = validator.call(api, self.params[key], self);
            }else{
              var method = prepareStringMethod(validator);
              validatorResponse = method.call(api, self.params[key], self);
            }
            if(validatorResponse !== true){ self.validatorErrors.push(validatorResponse); }
          });
        }

        // required
        if(props.required === true){
          if(api.config.general.missingParamChecks.indexOf(self.params[key]) >= 0){
            self.missingParams.push(key);
          }
        }
      }
    };

    api.actionProcessor.prototype.processAction = function(){
      var self = this;
      self.actionStartTime = new Date().getTime();
      self.working = true;
      self.incrementTotalActions();
      self.incrementPendingActions();
      self.action = self.params.action;

      if(api.actions.versions[self.action]){
        if(!self.params.apiVersion){
          self.params.apiVersion = api.actions.versions[self.action][api.actions.versions[self.action].length - 1];
        }
        self.actionTemplate = api.actions.actions[self.action][self.params.apiVersion];
      }

      if(api.running !== true){
        self.completeAction('server_shutting_down');
      }else if(self.getPendingActionCount(self.connection) > api.config.general.simultaneousActions){
        self.completeAction('too_many_requests');
      }else if(!self.action || !self.actionTemplate){
        self.completeAction('unknown_action');
      }else if(self.actionTemplate.blockedConnectionTypes && self.actionTemplate.blockedConnectionTypes.indexOf(self.connection.type) >= 0){
        self.completeAction('unsupported_server_type');
      }else{
        self.runAction();
      }
    };

    api.actionProcessor.prototype.runAction = function(){
      var self = this;

      self.preProcessAction(function(error){
        self.reduceParams();
        self.validateParams();

        if(error){
          self.completeAction(error);
        }else if(self.missingParams.length > 0){
          self.completeAction('missing_params');
        }else if(self.validatorErrors.length > 0){
          self.completeAction('validator_errors');
        }else if(self.toProcess === true && !error){
          self.actionTemplate.run(api, self, function(error){
            if(error){
              self.completeAction(error);
            }else{
              self.postProcessAction(function(error){
                self.completeAction(error);
              });
            }
          });
        }else{
          self.completeAction();
        }
      });
    };

    next();
  }
};
