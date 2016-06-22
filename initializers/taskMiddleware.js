'use strict';
var async = require('async');
var Util = require('util');

module.exports = {
  loadPriority:  698,
  initialize: function(api, next){
    var taskMiddleware = function(worker, func, queue, job, args, options){
      var self = this;
      self.name = 'taskMiddleware';
      self.worker = worker;
      self.queue = queue;
      self.func = func;
      self.job = job;
      self.args = args;
      self.options = options;

      if(self.worker.queueObject){
        self.queueObject = self.worker.queueObject;
      }else{
        self.queueObject = self.worker;
      }
    };

    ////////////////////
    // PLUGIN METHODS //
    ////////////////////

    taskMiddleware.prototype.before_perform = function(callback){
      var self = this;

      var processors = [];
      var processorNames = api.tasks.globalMiddleware.slice(0);

      if(self.job.middleware){
        self.job.middleware.forEach(function(m){ processorNames.push(m); });
      }

      processorNames.forEach(function(name){
        if(typeof api.tasks.middleware[name].preProcessor === 'function'){
          processors.push(function(next){ api.tasks.middleware[name].preProcessor(self, next); });
        }
      });

      async.series(processors, callback);
    };

    taskMiddleware.prototype.after_perform = function(callback){
      var self = this;

      var processors = [];
      var processorNames = api.tasks.globalMiddleware.slice(0);

      if(self.job.middleware){
        self.job.middleware.forEach(function(m){ processorNames.push(m); });
      }

      processorNames.forEach(function(name){
        if(typeof api.tasks.middleware[name].postProcessor === 'function'){
          processors.push(function(next){ api.tasks.middleware[name].postProcessor(self, next); });
        }
      });

      async.series(processors, callback);
    };

    api.taskMiddleware = taskMiddleware;

    next();
  }
};
