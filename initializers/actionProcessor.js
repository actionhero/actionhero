'use strict';

const async = require('async');

module.exports = {
  loadPriority:  430,
  initialize: function(api, next){

    const prepareStringMethod = function(method){
      const cmdParts = method.split('.');
      const cmd = cmdParts.shift();
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
      if(!count){ count = 1; }
      this.connection.totalActions = this.connection.totalActions + count;
    };

    api.actionProcessor.prototype.incrementPendingActions = function(count){
      if(!count){ count = 1; }
      this.connection.pendingActions = this.connection.pendingActions + count;
    };

    api.actionProcessor.prototype.getPendingActionCount = function(){
      return this.connection.pendingActions;
    };

    api.actionProcessor.prototype.completeAction = function(status){
      let error = null;
      this.actionStatus = String(status);

      if(status instanceof Error){
        error = status;
      }else if(status === 'server_shutting_down'){
        error = api.config.errors.serverShuttingDown(this);
      }else if(status === 'too_many_requests'){
        error = api.config.errors.tooManyPendingActions(this);
      }else if(status === 'unknown_action'){
        error = api.config.errors.unknownAction(this);
      }else if(status === 'unsupported_server_type'){
        error = api.config.errors.unsupportedServerType(this);
      }else if(status === 'missing_params'){
        error = api.config.errors.missingParams(this, this.missingParams);
      }else if(status === 'validator_errors'){
        error = api.config.errors.invalidParams(this, this.validatorErrors);
      }else if(status){
        error = status;
      }

      if(error && typeof error === 'string'){
        error = new Error(error);
      }

      if(error && !this.response.error){
        if(typeof this.response === 'string' || Array.isArray(this.response)){
          this.response = error.toString();
        }else{
          this.response.error = error;
        }
      }

      this.incrementPendingActions(-1);
      this.duration = new Date().getTime() - this.actionStartTime;

      process.nextTick(() => {
        if(typeof this.callback === 'function'){
          this.callback(this);
        }
      });

      this.working = false;
      this.logAction(error);
    };

    api.actionProcessor.prototype.logAction = function(error){
      // logging
      let logLevel = 'info';
      if(this.actionTemplate && this.actionTemplate.logLevel){
        logLevel = this.actionTemplate.logLevel;
      }

      let filteredParams = {};
      for(let i in this.params){
        if(api.config.general.filteredParams && api.config.general.filteredParams.indexOf(i) >= 0){
          filteredParams[i] = '[FILTERED]';
        }else if(typeof this.params[i] === 'string'){
          filteredParams[i] = this.params[i].substring(0, api.config.logger.maxLogStringLength);
        }else{
          filteredParams[i] = this.params[i];
        }
      }

      const logLine = {
        to: this.connection.remoteIP,
        action: this.action,
        params: JSON.stringify(filteredParams),
        duration: this.duration,
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

      api.log(['[ action @ %s ]', this.connection.type], logLevel, logLine);
    };

    api.actionProcessor.prototype.preProcessAction = function(callback){
      let processors     = [];
      let processorNames = api.actions.globalMiddleware.slice(0);

      if(this.actionTemplate.middleware){
        this.actionTemplate.middleware.forEach(function(m){ processorNames.push(m); });
      }

      processorNames.forEach((name) => {
        if(typeof api.actions.middleware[name].preProcessor === 'function'){
          processors.push((next) => { api.actions.middleware[name].preProcessor(this, next); });
        }
      });

      async.series(processors, callback);
    };

    api.actionProcessor.prototype.postProcessAction = function(callback){
      let processors     = [];
      let processorNames = api.actions.globalMiddleware.slice(0);

      if(this.actionTemplate.middleware){
        this.actionTemplate.middleware.forEach((m) => { processorNames.push(m); });
      }

      processorNames.forEach((name) => {
        if(typeof api.actions.middleware[name].postProcessor === 'function'){
          processors.push((next) => { api.actions.middleware[name].postProcessor(this, next); });
        }
      });

      async.series(processors, callback);
    };

    api.actionProcessor.prototype.reduceParams = function(){
      let inputNames = [];
      if(this.actionTemplate.inputs){
        inputNames = Object.keys(this.actionTemplate.inputs);
      }

      if(api.config.general.disableParamScrubbing !== true){
        for(let p in this.params){
          if(api.params.globalSafeParams.indexOf(p) < 0 && inputNames.indexOf(p) < 0){
            delete this.params[p];
          }
        }
      }
    };

    api.actionProcessor.prototype.validateParams = function(){
      for(let key in this.actionTemplate.inputs){
        const props = this.actionTemplate.inputs[key];

        // default
        if(this.params[key] === undefined && props['default'] !== undefined){
          if(typeof props['default'] === 'function'){
            this.params[key] = props['default'].call(api, this.params[key], this);
          }else{
            this.params[key] = props['default'];
          }
        }

        // formatter
        if(this.params[key] !== undefined && props.formatter !== undefined){
          if(!Array.isArray(props.formatter)){ props.formatter = [props.formatter]; }

          props.formatter.forEach((formatter) => {
            if(typeof formatter === 'function'){
              this.params[key] = formatter.call(api, this.params[key], this);
            }else{
              const method = prepareStringMethod(formatter);
              this.params[key] = method.call(api, this.params[key], this);
            }
          });
        }

        // validator
        if(this.params[key] !== undefined && props.validator !== undefined){
          if(!Array.isArray(props.validator)){ props.validator = [props.validator]; }

          props.validator.forEach((validator) => {
            let validatorResponse;
            if(typeof validator === 'function'){
              validatorResponse = validator.call(api, this.params[key], this);
            }else{
              const method = prepareStringMethod(validator);
              validatorResponse = method.call(api, this.params[key], this);
            }
            if(validatorResponse !== true){ this.validatorErrors.push(validatorResponse); }
          });
        }

        // required
        if(props.required === true){
          if(api.config.general.missingParamChecks.indexOf(this.params[key]) >= 0){
            this.missingParams.push(key);
          }
        }
      }
    };

    api.actionProcessor.prototype.processAction = function(){
      this.actionStartTime = new Date().getTime();
      this.working = true;
      this.incrementTotalActions();
      this.incrementPendingActions();
      this.action = this.params.action;

      if(api.actions.versions[this.action]){
        if(!this.params.apiVersion){
          this.params.apiVersion = api.actions.versions[this.action][api.actions.versions[this.action].length - 1];
        }
        this.actionTemplate = api.actions.actions[this.action][this.params.apiVersion];
      }

      if(api.running !== true){
        this.completeAction('server_shutting_down');
      }else if(this.getPendingActionCount(this.connection) > api.config.general.simultaneousActions){
        this.completeAction('too_many_requests');
      }else if(!this.action || !this.actionTemplate){
        this.completeAction('unknown_action');
      }else if(this.actionTemplate.blockedConnectionTypes && this.actionTemplate.blockedConnectionTypes.indexOf(this.connection.type) >= 0){
        this.completeAction('unsupported_server_type');
      }else{
        this.runAction();
      }
    };

    api.actionProcessor.prototype.runAction = function(){
      this.preProcessAction((error) => {
        this.reduceParams();
        this.validateParams();

        if(error){
          this.completeAction(error);
        }else if(this.missingParams.length > 0){
          this.completeAction('missing_params');
        }else if(this.validatorErrors.length > 0){
          this.completeAction('validator_errors');
        }else if(this.toProcess === true && !error){
          this.actionTemplate.run(api, this, (error) => {
            if(error){
              this.completeAction(error);
            }else{
              this.postProcessAction((error) => {
                this.completeAction(error);
              });
            }
          });
        }else{
          this.completeAction();
        }
      });
    };

    next();
  }
};
