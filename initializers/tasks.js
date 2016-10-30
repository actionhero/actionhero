'use strict';

const async = require('async');

module.exports = {
  startPriority: 900,
  loadPriority:  699,
  initialize: function(api, next){

    api.tasks = {

      tasks: {},
      jobs: {},
      middleware: {},
      globalMiddleware: [],

      loadFile: function(fullFilePath, reload){
        if(!reload){ reload = false; }

        const loadMessage = function(loadedTaskName){
          api.log(['task %s loaded: %s, %s', (reload ? '(re)' : ''), loadedTaskName, fullFilePath], 'debug');
        };

        api.watchFileAndAct(fullFilePath, () => {
          this.loadFile(fullFilePath, true);
        });

        let task;
        try{
          const collection = require(fullFilePath);
          for(let i in collection){
            task = collection[i];
            api.tasks.tasks[task.name] = task;
            this.validateTask(api.tasks.tasks[task.name]);
            api.tasks.jobs[task.name] = this.jobWrapper(task.name);
            loadMessage(task.name);
          }
        }catch(error){
          api.exceptionHandlers.loader(fullFilePath, error);
          delete api.tasks.tasks[task.name];
          delete api.tasks.jobs[task.name];
        }
      },

      jobWrapper: function(taskName){
        const task = api.tasks.tasks[taskName];

        let middleware = task.middleware || [];
        let plugins = task.plugins || [];
        let pluginOptions = task.pluginOptions || [];

        if(task.frequency > 0){
          if(plugins.indexOf('jobLock') < 0){ plugins.push('jobLock'); }
          if(plugins.indexOf('queueLock') < 0){ plugins.push('queueLock'); }
          if(plugins.indexOf('delayQueueLock') < 0){ plugins.push('delayQueueLock'); }
        }

        //load middleware into plugins
        const processMiddleware = (m) => {
          if(api.tasks.middleware[m]){ //Ignore middleware until it has been loaded.
            const plugin = function(worker, func, queue, job, args, options){
              this.name = m;
              this.worker = worker;
              this.queue = queue;
              this.func = func;
              this.job = job;
              this.args = args;
              this.options = options;
              this.api = api;

              if(this.worker.queueObject){
                this.queueObject = this.worker.queueObject;
              }else{
                this.queueObject = this.worker;
              }
            };

            if(api.tasks.middleware[m].preProcessor){ plugin.prototype.before_perform = api.tasks.middleware[m].preProcessor; }
            if(api.tasks.middleware[m].postProcessor){ plugin.prototype.after_perform = api.tasks.middleware[m].postProcessor; }
            if(api.tasks.middleware[m].preEnqueue){ plugin.prototype.before_enqueue = api.tasks.middleware[m].preEnqueue; }
            if(api.tasks.middleware[m].postEnqueue){ plugin.prototype.after_enqueue = api.tasks.middleware[m].postEnqueue; }

            plugins.push(plugin);
          }
        };

        api.tasks.globalMiddleware.forEach(processMiddleware);
        middleware.forEach(processMiddleware);

        // TODO: solve scope issues here
        var self = this;
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
        };
      },

      validateTask: function(task){
        const fail = (msg) => {
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

      stats: function(callback){
        api.resque.queue.stats(callback);
      },

      queued: function(q, start, stop, callback){
        api.resque.queue.queued(q, start, stop, callback);
      },

      delQueue: function(q, callback){
        api.resque.queue.delQueue(q, callback);
      },

      locks: function(callback){
        api.resque.queue.locks(callback);
      },

      delLock: function(lock, callback){
        api.resque.queue.delLock(lock, callback);
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
        const task = this.tasks[taskName];

        if(task.frequency <= 0){
          callback();
        }else{
          this.del(task.queue, taskName, {}, () => {
            this.delDelayed(task.queue, taskName, {}, () => {
              this.enqueueIn(task.frequency, taskName, () => {
                api.log(['re-enqueued recurrent job %s', taskName], api.config.tasks.schedulerLogging.reEnqueue);
                callback();
              });
            });
          });
        }
      },

      enqueueAllRecurrentJobs: function(callback){
        let jobs = [];
        let loadedTasks = [];

        Object.keys(this.tasks).forEach((taskName) => {
          const task = this.tasks[taskName];
          if(task.frequency > 0){
            jobs.push((done) => {
              this.enqueue(taskName, (error, toRun) => {
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
        const task = this.tasks[taskName];
        if(task.frequency <= 0){
          callback();
        }else{
          let removedCount = 0;
          this.del(task.queue, task.name, {}, 1, (error, count) => {
            removedCount = removedCount + count;
            this.delDelayed(task.queue, task.name, {}, (error, timestamps) => {
              removedCount = removedCount + timestamps.length;
              callback(error, removedCount);
            });
          });
        }
      },

      details: function(callback){
        let details = {'queues': {}, 'workers': {}};
        let jobs = [];

        jobs.push((done) => {
          api.tasks.allWorkingOn((error, workers) => {
            if(error){ return done(error); }
            details.workers = workers;
            return done();
          });
        });

        jobs.push((done) => {
          api.tasks.stats((error, stats) => {
            if(error){ return done(error); }
            details.stats = stats;
            return done();
          });
        });

        jobs.push((done) => {
          api.resque.queue.queues((error, queues) => {
            if(error){ return done(error); }
            let queueJobs = [];

            queues.forEach((queue) => {
              queueJobs.push((qdone) => {
                api.resque.queue.length(queue, (error, length) => {
                  if(error){ return qdone(error); }
                  details.queues[queue] = { length: length };
                  return qdone();
                });
              });
            });

            async.parallel(queueJobs, done);
          });
        });

        async.parallel(jobs, (error) => {
          return callback(error, details);
        });
      }
    };

    function loadTasks(reload){
      api.config.general.paths.task.forEach((p) => {
        api.utils.recursiveDirectoryGlob(p).forEach((f) => {
          api.tasks.loadFile(f, reload);
        });
      });
    }

    api.tasks.addMiddleware = function(middleware){
      if(!middleware.name){ throw new Error('middleware.name is required'); }
      if(!middleware.priority){ middleware.priority = api.config.general.defaultMiddlewarePriority; }
      middleware.priority = Number(middleware.priority);
      api.tasks.middleware[middleware.name] = middleware;
      if(middleware.global === true){
        api.tasks.globalMiddleware.push(middleware.name);
        api.utils.sortGlobalMiddleware(api.tasks.globalMiddleware, api.tasks.middleware);
      }
      loadTasks(true);
    };

    loadTasks(false);

    next();

  },

  start: function(api, next){
    if(api.config.tasks.scheduler === true){
      api.tasks.enqueueAllRecurrentJobs((error) => {
        next(error);
      });
    }else{
      next();
    }
  },
};
