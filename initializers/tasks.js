'use strict';
const crypto = require('crypto');

var async = require('async');

module.exports = {
  startPriority: 900,
  loadPriority:  699,
  initialize: function(api, next){

    function hashRun(runFunc){
      const funcString = runFunc.toString();
      return crypto.createHash('sha1').update(funcString).digest('hex');
    }

    function needsMigration(params, currentRunFunc){
      const currentHash = hashRun(currentRunFunc);
      const hashDiff = params._hash !== currentHash;
      if(hashDiff){
        api.log("Task Run Function has changed!", "debug", {old: params._hash, current: currentHash});
      }

      return hashDiff;
    }

    api.tasks = {

      tasks: {},
      jobs: {},

      loadFile: function(fullFilePath, reload){
        var self = this;
        if(!reload){ reload = false; }

        var loadMessage = function(loadedTaskName){
          api.log(['task %sloaded: %s, %s', (reload ? '(re)' : ''), loadedTaskName, fullFilePath], 'debug');
        };

        api.watchFileAndAct(fullFilePath, function(){
          self.loadFile(fullFilePath, true);
        });

        var task;
        try{
          var collection = require(fullFilePath);
          for(var i in collection){
            task = collection[i];
            api.tasks.tasks[task.name] = task;
            self.validateTask(api.tasks.tasks[task.name]);
            api.tasks.jobs[task.name] = self.jobWrapper(task.name);
            loadMessage(task.name);
          }
        }catch(error){
          api.exceptionHandlers.loader(fullFilePath, error);
          delete api.tasks.tasks[task.name];
          delete api.tasks.jobs[task.name];
        }
      },

      jobWrapper: function(taskName){
        var self = this;
        var task = api.tasks.tasks[taskName];
        var plugins = task.plugins || [];
        var pluginOptions = task.pluginOptions || [];
        if(task.frequency > 0){
          if(plugins.indexOf('jobLock') < 0){ plugins.push('jobLock'); }
          if(plugins.indexOf('queueLock') < 0){ plugins.push('queueLock'); }
          if(plugins.indexOf('delayQueueLock') < 0){ plugins.push('delayQueueLock'); }
        }
        return {
          'plugins': plugins,
          'pluginOptions': pluginOptions,
          'migrate': api.tasks.tasks[taskName].migrate,
          'perform': function(){
            var args = Array.prototype.slice.call(arguments);
            var cb = args.pop();
            if(args.length === 0){
              args.push({}); // empty params array
            }
            args.push(
              function(error, resp){
                self.enqueueRecurrentJob(taskName, function(){
                  cb(error, resp);
                });
              }
            );
            args.splice(0, 0, api);

            if(api.tasks.tasks[taskName].migrate && needsMigration(args[1], api.tasks.tasks[taskName].run)){
              var _self = this;
              api.tasks.tasks[taskName].migrate.call(_self, args[0], args[1], function(newParams){
                api.tasks.tasks[taskName].run.call(_self, args[0], newParams, args[2]);
              });
            } else {
              api.tasks.tasks[taskName].run.apply(this, args);
            }
          }
        };
      },

      validateTask: function(task){
        var fail = function(msg){
          api.log(msg + '; exiting.', 'emerg');
        };
        if(typeof task.name !== 'string' || task.name.length < 1){
          fail('a task is missing \'task.name\'');
          return false;
        }else if(typeof task.description !== 'string' || task.description.length < 1){
          fail('Task ' + task.name + ' is missing \'task.description\'');
          return false;
        }else if(typeof task.frequency !== 'number'){
          fail('Task ' + task.name + ' has no frequency');
          return false;
        }else if(typeof task.queue !== 'string'){
          fail('Task ' + task.name + ' has no queue');
          return false;
        }else if(typeof task.run !== 'function'){
          fail('Task ' + task.name + ' has no run method');
          return false;
        }else{
          return true;
        }
      },

      enqueue: function(taskName, params, queue, callback){
        if(typeof queue === 'function' && callback === undefined){ callback = queue; queue = this.tasks[taskName].queue; }
        else if(typeof params === 'function' && callback === undefined && queue === undefined){ callback = params; queue = this.tasks[taskName].queue; params = {}; }
        params._hash = hashRun(api.tasks.tasks[taskName].run);
        api.resque.queue.enqueue(queue, taskName, params, callback);
      },

      enqueueAt: function(timestamp, taskName, params, queue, callback){
        if(typeof queue === 'function' && callback === undefined){ callback = queue; queue = this.tasks[taskName].queue; }
        else if(typeof params === 'function' && callback === undefined && queue === undefined){ callback = params; queue = this.tasks[taskName].queue; params = {}; }
        params._hash = hashRun(api.tasks.tasks[taskName].run);
        api.resque.queue.enqueueAt(timestamp, queue, taskName, params, callback);
      },

      enqueueIn: function(time, taskName, params, queue, callback){
        if(typeof queue === 'function' && callback === undefined){ callback = queue; queue = this.tasks[taskName].queue; }
        else if(typeof params === 'function' && callback === undefined && queue === undefined){ callback = params; queue = this.tasks[taskName].queue; params = {}; }
        params._hash = hashRun(api.tasks.tasks[taskName].run);
        api.resque.queue.enqueueIn(time, queue, taskName, params, callback);
      },

      del: function(q, taskName, args, count, callback){
        api.resque.queue.del(q, taskName, args, count, callback);
      },

      delDelayed: function(q, taskName, args, callback){
        api.resque.queue.delDelayed(q, taskName, args, callback);
      },

      scheduledAt: function(q, taskName, args, callback){
        api.resque.queue.scheduledAt(q, taskName, args, callback);
      },

      timestamps: function(callback){
        api.resque.queue.timestamps(callback);
      },

      delayedAt: function(timestamp, callback){
        api.resque.queue.delayedAt(timestamp, callback);
      },

      allDelayed: function(callback){
        api.resque.queue.allDelayed(callback);
      },

      workers: function(callback){
        api.resque.queue.workers(callback);
      },

      workingOn: function(workerName, queues, callback){
        api.resque.queue.workingOn(workerName, queues, callback);
      },

      allWorkingOn: function(callback){
        api.resque.queue.allWorkingOn(callback);
      },

      failedCount: function(callback){
        api.resque.queue.failedCount(callback);
      },

      failed: function(start, stop, callback){
        api.resque.queue.failed(start, stop, callback);
      },

      removeFailed: function(failedJob, callback){
        api.resque.queue.removeFailed(failedJob, callback);
      },

      retryAndRemoveFailed: function(failedJob, callback){
        api.resque.queue.retryAndRemoveFailed(failedJob, callback);
      },

      cleanOldWorkers: function(age, callback){
        api.resque.queue.cleanOldWorkers(age, callback);
      },

      enqueueRecurrentJob: function(taskName, callback){
        var self = this;
        var task = self.tasks[taskName];
        if(task.frequency <= 0){
          callback();
        }else{
          self.del(task.queue, taskName, {}, function(){
            self.delDelayed(task.queue, taskName, {}, function(){
              self.enqueueIn(task.frequency, taskName, function(){
                api.log(['re-enqueued recurrent job %s', taskName], api.config.tasks.schedulerLogging.reEnqueue);
                callback();
              });
            });
          });
        }
      },

      enqueueAllRecurrentJobs: function(callback){
        var self = this;
        var jobs = [];
        var loadedTasks = [];
        Object.keys(self.tasks).forEach(function(taskName){
          var task = self.tasks[taskName];
          if(task.frequency > 0){
            jobs.push(function(done){
              self.enqueue(taskName, function(error, toRun){
                if(error){ return done(error); }
                if(toRun === true){
                  api.log(['enqueuing periodic task: %s', taskName], api.config.tasks.schedulerLogging.enqueue);
                  loadedTasks.push(taskName);
                }
                return done();
              });
            });
          }
        });

        async.series(jobs, function(error){
          if(error){ return callback(error); }
          return callback(null, loadedTasks);
        });
      },

      stopRecurrentJob: function(taskName, callback){
        // find the jobs in either the normal queue or delayed queues
        var self = this;
        var task = self.tasks[taskName];
        if(task.frequency <= 0){
          callback();
        }else{
          var removedCount = 0;
          self.del(task.queue, task.name, {}, 1, function(error, count){
            removedCount = removedCount + count;
            self.delDelayed(task.queue, task.name, {}, function(error, timestamps){
              removedCount = removedCount + timestamps.length;
              callback(error, removedCount);
            });
          });
        }
      },

      details: function(callback){
        var details = {'queues': {}, 'workers': {}};
        var jobs = [];

        jobs.push(function(done){
          api.tasks.allWorkingOn(function(error, workers){
            if(error){ return done(error); }
            details.workers = workers;
            return done();
          });
        });

        jobs.push(function(done){
          api.resque.queue.queues(function(error, queues){
            if(error){ return done(error); }
            var queueJobs = [];

            queues.forEach(function(queue){
              queueJobs.push(function(qdone){
                api.resque.queue.length(queue, function(error, length){
                  if(error){ return qdone(error); }
                  details.queues[queue] = { length: length };
                  return qdone();
                });
              });
            });

            async.parallel(queueJobs, done);
          });
        });

        async.parallel(jobs, function(error){
          return callback(error, details);
        });
      }
    };

    api.config.general.paths.task.forEach(function(p){
      api.utils.recursiveDirectoryGlob(p).forEach(function(f){
        api.tasks.loadFile(f);
      });
    });

    next();

  },

  start: function(api, next){
    if(api.config.tasks.scheduler === true){
      api.tasks.enqueueAllRecurrentJobs(function(error){
        next(error);
      });
    }else{
      next();
    }
  },
};
