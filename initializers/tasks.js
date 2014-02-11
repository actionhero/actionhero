var fs = require('fs');

var tasks = function(api, next){

  api.tasks = new api.commonLoader;


  api.tasks.tasks = {};
  api.tasks.jobs = {};

  api.tasks._start = function(api, next){
    if(api.config.tasks.scheduler === true){
      api.tasks.enqueueAllRecurrentJobs(function(){
        next();
      });
    }else{
      next();
    }
  };
  
  api.tasks.fileHandler = function(this_task, reload){    
    this.tasks[this_task.name] = this_task;
    this.validate(api.tasks.tasks[this_task.name]);
    this.jobs[this_task.name] = this.jobWrapper(this_task.name);
  };
    
  api.tasks.jobWrapper = function(taskName){
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
        var error = null;
        if(args.length == 0){
          args.push({}); // empty params array
        }
        args.push(
          function(resp){
            self.enqueueRecurrentJob(taskName, function(){
              cb(error, resp);
            });
          }
        );
        args.splice(0, 0, api);
        api.tasks.tasks[taskName].run.apply(null, args);
      }
    }
  };

  api.tasks.validate = function(task){
    return this._validate(task, {
      'name':'string',
      'description':'string', 
      'frequency':'number', 
      'queue':'string', 
      'run':'function' 
    });
  };

  api.tasks.enqueue = function(taskName, params, queue, callback){
    if(typeof queue === 'function' && callback == null){ callback = queue; queue = this.tasks[taskName].queue; }
    else if(typeof params === 'function' && callback == null && queue == null){ callback = params; queue = this.tasks[taskName].queue; params = {}; }
    api.resque.queue.enqueue(queue, taskName, params, callback);
  };

  api.tasks.enqueueAt = function(timestamp, taskName, params, queue, callback){
    if(typeof queue === 'function' && callback == null){ callback = queue; queue = this.tasks[taskName].queue; }
    else if(typeof params === 'function' && callback == null && queue == null){ callback = params; queue = this.tasks[taskName].queue; params = {}; }
    api.resque.queue.enqueueAt(timestamp, queue, taskName, params, callback);
  };

  api.tasks.enqueueIn = function(time, taskName, params, queue, callback){
    if(typeof queue === 'function' && callback == null){ callback = queue; queue = this.tasks[taskName].queue; }
    else if(typeof params === 'function' && callback == null && queue == null){ callback = params; queue = this.tasks[taskName].queue; params = {}; }
    api.resque.queue.enqueueIn(time, queue, taskName, params, callback);
  };

  api.tasks.del = function(q, taskName, args, count, callback){
    api.resque.queue.del(q, taskName, args, count, callback);
  };

  api.tasks.delDelayed = function(q, taskName, args, callback){
    api.resque.queue.delDelayed(q, taskName, args, callback);
  };

  api.tasks.enqueueRecurrentJob = function(taskName, callback){
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
  };

  api.tasks.enqueueAllRecurrentJobs = function(callback){
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
            if(started == 0 && typeof callback == 'function'){ callback(loadedTasks) }
          });
        })(taskName)
      }
    }
    if(started == 0 && typeof callback == 'function'){ callback(loadedTasks) }
  };

  api.tasks.stopRecurrentJob = function(taskName, callback){
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
  };

  api.tasks.details = function(callback){
    var self = this;
    var details = {'queues': {}};
    api.resque.queue.queues(function(err, queues){
      if(queues.length == 0){ callback(null, details) }
      else {
        var started = 0;
        queues.forEach(function(queue){
          started++;
          api.resque.queue.length(queue, function(err, length){
            details['queues'][queue] = {
              length: length
            }
            started--;
            if(started == 0){ callback(null, details) }
          });
        });
      }
    });
  };
  
   api.tasks.exceptionManager = function(fullFilePath, err, task){
    api.exceptionHandlers.loader(fullFilePath, err);
    delete api.tasks.tasks[task.name];
    delete api.tasks.jobs[task.name];
  }; 

  api.tasks.initialize(api.config.general.paths.task);
  next();
  
};

exports.tasks = tasks;
