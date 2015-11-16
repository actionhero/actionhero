module.exports = {
  startPriority: 900,
  loadPriority:  699,
  initialize: function(api, next){

    api.tasks = {

      tasks: {},
      jobs: {},

      loadFile: function(fullFilePath, reload){
        var self = this;
        if(!reload){ reload = false }

        var loadMessage = function(loadedTaskName){
          api.log('task ' + (reload?'(re)':'') + 'loaded: ' + loadedTaskName + ', ' + fullFilePath, 'debug');
        }

        api.watchFileAndAct(fullFilePath, function(){
          self.loadFile(fullFilePath, true);
        });

        try {
          var collection = require(fullFilePath);
          for(var i in collection){
            var task = collection[i];
            api.tasks.tasks[task.name] = task;
            self.validateTask(api.tasks.tasks[task.name]);
            api.tasks.jobs[task.name] = self.jobWrapper(task.name);
            loadMessage(task.name);
          }
        } catch(err){
          api.exceptionHandlers.loader(fullFilePath, err);
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
          if(plugins.indexOf('jobLock') < 0)       { plugins.push('jobLock'); }
          if(plugins.indexOf('queueLock') < 0)     { plugins.push('queueLock'); }
          if(plugins.indexOf('delayQueueLock') < 0){ plugins.push('delayQueueLock'); }
        }
        return {
          'plugins': plugins,
          'pluginOptions': pluginOptions,
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
            api.tasks.tasks[taskName].run.apply(this, args);
          }
        }
      },

      validateTask: function(task){
        var fail = function(msg){
          api.log(msg + '; exiting.', 'emerg');
        }
        if(typeof task.name !== 'string' || task.name.length < 1){
          fail('a task is missing \'task.name\'');
          return false;
        } else if(typeof task.description !== 'string' || task.description.length < 1){
          fail('Task ' + task.name + ' is missing \'task.description\'');
          return false;
        } else if(typeof task.frequency !== 'number'){
          fail('Task ' + task.name + ' has no frequency');
          return false;
        } else if(typeof task.queue !== 'string'){
          fail('Task ' + task.name + ' has no queue');
          return false;
        } else if(typeof task.run !== 'function'){
          fail('Task ' + task.name + ' has no run method');
          return false;
        } else {
          return true;
        }
      },

      enqueue: function(taskName, params, queue, callback){
        if(typeof queue === 'function' && callback === undefined){ callback = queue; queue = this.tasks[taskName].queue; }
        else if(typeof params === 'function' && callback === undefined && queue === undefined){ callback = params; queue = this.tasks[taskName].queue; params = {}; }
        api.resque.queue.enqueue(queue, taskName, params, callback);
      },

      enqueueAt: function(timestamp, taskName, params, queue, callback){
        if(typeof queue === 'function' && callback === undefined){ callback = queue; queue = this.tasks[taskName].queue; }
        else if(typeof params === 'function' && callback === undefined && queue === undefined){ callback = params; queue = this.tasks[taskName].queue; params = {}; }
        api.resque.queue.enqueueAt(timestamp, queue, taskName, params, callback);
      },

      enqueueIn: function(time, taskName, params, queue, callback){
        if(typeof queue === 'function' && callback === undefined){ callback = queue; queue = this.tasks[taskName].queue; }
        else if(typeof params === 'function' && callback === undefined && queue === undefined){ callback = params; queue = this.tasks[taskName].queue; params = {}; }
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
        } else {
          self.del(task.queue, taskName, {}, function(){
            self.delDelayed(task.queue, taskName, {}, function(){
              self.enqueueIn(task.frequency, taskName, function(){
                api.log('re-enqueued recurrent job ' + taskName, 'debug');
                callback();
              });
            });
          });
        }
      },

      enqueueAllRecurrentJobs: function(callback){
        var self = this;
        var started = 0;
        var loadedTasks = []
        for(var taskName in self.tasks){
          var task = self.tasks[taskName];
          if(task.frequency > 0){
            started++;
            (function(taskName){
              self.enqueue(taskName, function(err, toRun){
                if(toRun === true){ 
                  api.log('enqueuing periodic task: ' + taskName, 'info');
                  loadedTasks.push(taskName);
                }
                started--;
                if(started === 0 && typeof callback === 'function'){ callback(loadedTasks) }
              });
            })(taskName)
          }
        }
        if(started === 0 && typeof callback === 'function'){ callback(loadedTasks) }
      },

      stopRecurrentJob: function(taskName, callback){
        // find the jobs in either the normal queue or delayed queues
        var self = this;
        var task = self.tasks[taskName];
        if(task.frequency <= 0){
          callback();
        } else {
          var removedCount = 0;
          self.del(task.queue, task.name, {}, 1, function(err, count){
            removedCount = removedCount + count;
            self.delDelayed(task.queue, task.name, {}, function(err, timestamps){
              removedCount = removedCount + timestamps.length;
              callback(err, removedCount);
            });
          });
        }
      },

      details: function(callback){
        var details = {'queues': {}, 'workers': {} };
        api.tasks.allWorkingOn(function(err, workers){
          if(err){
            callback(err, details);
          }else{
            details.workers = workers;
            api.resque.queue.queues(function(err, queues){
              if(err){
                callback(err, details);
              }
              else if(queues.length === 0){ callback(null, details) }
              else {
                var started = 0;
                queues.forEach(function(queue){
                  started++;
                  api.resque.queue.length(queue, function(err, length){
                    details.queues[queue] = {
                      length: length
                    }
                    started--;
                    if(started === 0){ callback(err, details) }
                  });
                });
              }
            });
          }
        });
      }
    }

    api.config.general.paths.task.forEach(function(p){
      api.utils.recursiveDirectoryGlob(p).forEach(function(f){
        api.tasks.loadFile(f);
      });
    })

    next();
    
  }, 

  start: function(api, next){
    if(api.config.tasks.scheduler === true){
      api.tasks.enqueueAllRecurrentJobs(function(){
        next();
      });
    }else{
      next();
    }
  },
}