var fs = require('fs');

var tasks = function(api, next){

  api.tasks = {

    tasks: {},
    jobs: {},

    _start: function(api, next){
      if(api.config.tasks.scheduler === true){
        api.tasks.enqueueAllRecurrentJobs(function(){
          next();
        });
      }else{
        next();
      }
    },

    _teardown: function(api, next){
      next();
    },

    load: function(fullFilePath, reload){
      var self = this;
      if(null === reload){ reload = false }

      var loadMessage = function(loadedTaskName){
        api.log('task ' + (reload?'(re)':'') + 'loaded: ' + loadedTaskName + ', ' + fullFilePath, 'debug');
      }

      api.watchFileAndAct(fullFilePath, function(){
        var cleanPath = fullFilePath;
        if('win32' === process.platform){
          cleanPath = fullFilePath.replace(/\//g, '\\');
        }

        delete require.cache[require.resolve(cleanPath)];
        self.load(fullFilePath, true);
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
          if(0 === args.length){
            args.push({}); // empty params array
          }
          args.push(
            function(resp){
              self.enqueueRecurrentJob(taskName, function(){
                cb(resp);
              });
            }
          );
          args.splice(0, 0, api);
          api.tasks.tasks[taskName].run.apply(null, args);
        }
      }
    },

    validateTask: function(task){
      var fail = function(msg){
        api.log(msg + '; exiting.', 'emerg');
      }
      if('string' !== typeof task.name || task.name.length < 1){
        fail('a task is missing \'task.name\'');
        return false;
      } else if('string' !== typeof task.description || task.description.length < 1){
        fail('Task ' + task.name + ' is missing \'task.description\'');
        return false;
      } else if('number' !== typeof task.frequency){
        fail('Task ' + task.name + ' has no frequency');
        return false;
      } else if('string' !== typeof task.queue){
        fail('Task ' + task.name + ' has no queue');
        return false;
      } else if('function' !== typeof task.run){
        fail('Task ' + task.name + ' has no run method');
        return false;
      } else {
        return true;
      }
    },
    
    loadFolder: function(path){
      var self = this;

      if(null === path){
        path = api.config.general.paths.task;
      }
      
      if(fs.existsSync(path)){
        fs.readdirSync(path).forEach( function(file) {
          if('/' !== path[path.length - 1]){ path += '/' }
          var fullFilePath = path + file;
          if('.' !== file[0]){
            var stats = fs.statSync(fullFilePath);
            if(stats.isDirectory()){
              self.loadFolder(fullFilePath);
            } else if(stats.isSymbolicLink()){
              var realPath = fs.readlinkSync(fullFilePath);
              self.loadFolder(realPath);
            } else if(stats.isFile()){
              var ext = file.split('.')[1];
              if('js' === ext){ api.tasks.load(fullFilePath) }
            } else {
              api.log(file + ' is a type of file I cannot read', 'alert')
            }
          }
        });
      } else {
        api.log('no tasks folder found, skipping', 'debug');
      }
    },

    enqueue: function(taskName, params, queue, callback){
      if('function' === typeof queue && null === callback){ callback = queue; queue = this.tasks[taskName].queue; }
      else if('function' === typeof params && null === callback && null === queue){ callback = params; queue = this.tasks[taskName].queue; params = {}; }
      api.resque.queue.enqueue(queue, taskName, params, callback);
    },

    enqueueAt: function(timestamp, taskName, params, queue, callback){
      if('function' === typeof queue && null === callback){ callback = queue; queue = this.tasks[taskName].queue; }
      else if('function' === typeof params && null === callback && null === queue){ callback = params; queue = this.tasks[taskName].queue; params = {}; }
      api.resque.queue.enqueueAt(timestamp, queue, taskName, params, callback);
    },

    enqueueIn: function(time, taskName, params, queue, callback){
      if('function' === typeof queue && null === callback){ callback = queue; queue = this.tasks[taskName].queue; }
      else if('function' === typeof params && null === callback && null === queue){ callback = params; queue = this.tasks[taskName].queue; params = {}; }
      api.resque.queue.enqueueIn(time, queue, taskName, params, callback);
    },

    del: function(q, taskName, args, count, callback){
      api.resque.queue.del(q, taskName, args, count, callback);
    },

    delDelayed: function(q, taskName, args, callback){
      api.resque.queue.delDelayed(q, taskName, args, callback);
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
          loadedTasks.push(taskName);
          (function(taskName){
            self.enqueue(taskName, function(err, toRun){
              if(true === toRun){ api.log('enqueuing periodic task: ' + taskName, 'info') }
              started--;
              if(0 === started && 'function' === typeof callback){ callback(loadedTasks) }
            });
          })(taskName)
        }
      }
      if(0 === started && 'function' === typeof callback){ callback(loadedTasks) }
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
      var self = this;
      var details = {'queues': {}};
      api.resque.queue.queues(function(err, queues){
        if(0 === queues.length){ callback(null, details) }
        else {
          var started = 0;
          queues.forEach(function(queue){
            started++;
            api.resque.queue.length(queue, function(err, length){
              details['queues'][queue] = { length: length }
              started--;
              if(0 === started){ callback(null, details) }
            });
          });
        }
      });
    }
  }

  api.tasks.loadFolder();
  next();
  
};


exports.tasks = tasks;
