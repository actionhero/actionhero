var fs = require('fs');

var tasks = function(api, next){

  api.tasks = {

    tasks: {},
    jobs: {},

    _start: function(api, next){
      if(api.configData.tasks.scheduler === true){
        api.tasks.enqueueAllRecurentJobs(function(){
          next();
        });
      }else{
        next();
      }
    },

    _teardown: function(api, next){
      next();
    },

    load: function(fullfFilePath, reload){
      var self = this;
      if(reload == null){ reload = false; }

      var loadMessage = function(loadedTaskName){
        if(reload){
          loadMessage = "task (re)loaded: " + loadedTaskName + ", " + fullfFilePath;
        }else{
          var loadMessage = "task loaded: " + loadedTaskName + ", " + fullfFilePath;
        }
        api.log(loadMessage, "debug");
      }

      if(!reload){
        if(api.configData.general.developmentMode == true){
          api.watchedFiles.push(fullfFilePath);
          (function() {
            fs.watchFile(fullfFilePath, {interval:1000}, function(curr, prev){
              if(curr.mtime > prev.mtime){
                process.nextTick(function(){
                  if(fs.readFileSync(fullfFilePath).length > 0){
                    var cleanPath;
                    if(process.platform === 'win32'){
                      cleanPath = fullfFilePath.replace(/\//g, "\\");
                    } else {
                      cleanPath = fullfFilePath;
                    }

                    delete require.cache[require.resolve(cleanPath)];
                    self.load(fullfFilePath, true);
                  }
                });
              }
            });
          })();
        }
      }
      try{
        var collection = require(fullfFilePath);
        for(var i in collection){
          var task = collection[i];
          api.tasks.tasks[task.name] = task;
          self.validateTask(api.tasks.tasks[task.name]);
          api.tasks.jobs[task.name] = self.jobWrapper(task.name);
          loadMessage(task.name);
        }
      }catch(err){
        api.exceptionHandlers.loader(fullfFilePath, err);
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
        plugins.push('jobLock');
        plugins.push('queueLock');
        plugins.push('delayQueueLock');
      }
      return { 
        'plugins': plugins,
        'pluginOptions': pluginOptions,
        'perform': function(){
          var args = Array.prototype.slice.call(arguments);
          var cb = args.pop();
          if(args.length == 0){
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
        api.log(msg + "; exiting.", "emerg");
        process.exit();
      }
      if(typeof task.name != "string" || task.name.length < 1){
        fail("a task is missing `task.name`");
      }else if(typeof task.description != "string" || task.description.length < 1){
        fail("Task "+task.name+" is missing `task.description`");
      }else if(typeof task.frequency != "number"){
        fail("Task "+task.name+" has no frequency"); 
      }else if(typeof task.queue != "string"){
        fail("Task "+task.name+" has no queue");  
      }else if(typeof task.run != "function"){
        fail("Task "+task.name+" has no run method");
      }
    },
    
    loadFolder: function(path){
      var self = this;

      if(path == null){
        path = api.configData.general.paths.task;
      }
      
      if(fs.existsSync(path)){
        fs.readdirSync(path).forEach( function(file) {
          if(path[path.length - 1] != "/"){ path += "/"; } 
          var fullfFilePath = path + file;
          if (file[0] != "."){
            var stats = fs.statSync(fullfFilePath);
            if(stats.isDirectory()){
              self.loadFolder(fullfFilePath);
            }else if(stats.isSymbolicLink()){
              var realPath = readlinkSync(fullfFilePath);
              self.loadFolder(realPath);
            }else if(stats.isFile()){
              var ext = file.split('.')[1];
              if (ext === 'js')
                api.tasks.load(fullfFilePath);
            }else{
              api.log(file+" is a type of file I cannot read", "alert")
            }
          }
        });
      }else{
        api.log("no tasks folder found, skipping", "debug");
      }
    },

    enqueue: function(taskName, params, queue, callback){
      if(typeof queue === "function" && callback == null){ callback = queue; queue = this.tasks[taskName].queue; }
      else if(typeof params === "function" && callback == null && queue == null){ callback = params; queue = this.tasks[taskName].queue; params = {}; }
      api.resque.queue.enqueue(queue, taskName, params, callback);
    },

    enqueueAt: function(timestamp, taskName, params, queue, callback){
      if(typeof queue === "function" && callback == null){ callback = queue; queue = this.tasks[taskName].queue; }
      else if(typeof params === "function" && callback == null && queue == null){ callback = params; queue = this.tasks[taskName].queue; params = {}; }
      api.resque.queue.enqueueAt(timestamp, queue, taskName, params, callback);
    },

    enqueueIn: function(time, taskName, params, queue, callback){
      if(typeof queue === "function" && callback == null){ callback = queue; queue = this.tasks[taskName].queue; }
      else if(typeof params === "function" && callback == null && queue == null){ callback = params; queue = this.tasks[taskName].queue; params = {}; }
      api.resque.queue.enqueueIn(time, queue, taskName, params, callback);
    },

    del: function(q, func, args, count, callback){
      api.resque.queue.del(q, func, args, count, callback);
    },

    delDelayed: function(q, func, args, callback){
      api.resque.queue.delDelayed(q, func, args, callback);
    },

    enqueueRecurrentJob: function(taskName, callback){
      var self = this;
      var task = self.tasks[taskName];
      if(task.frequency <= 0){
        callback();
      }else{
        self.enqueueIn(task.frequency, taskName, function(){
          api.log("re-enqueued reccurent job " + taskName, "debug");
          callback();
        });
      }
    },

    enqueueAllRecurentJobs: function(callback){
      var self = this;
      var started = 0;
      var loadedTasks = []
      for(var taskName in self.tasks){
        var task = self.tasks[taskName];
        if(task.frequency > 0){
          started++;
          loadedTasks.push(taskName);
          self.enqueue(taskName, function(err, toRun){
            if(toRun === true){ api.log("enqueuing periodic task: " + taskName, 'info'); }
            started--;
            if(started == 0 && typeof callback == 'function'){ callback(loadedTasks); }
          })
        }
      }
      if(started == 0 && typeof callback == 'function'){ callback(loadedTasks); }
    },

    details: function(callback){
      var self = this;
      var details = {'queues': {}};
      api.resque.queue.queues(function(err, queues){
        if(queues.length == 0){ callback(null, details); }
        else{
          var started = 0;
          queues.forEach(function(queue){
            started++;
            api.resque.queue.length(queue, function(err, length){
              details['queues'][queue] = {
                length: length,
              }
              started--;
              if(started == 0){ callback(null, details); }
            });
          });
        }
      });
    },
  }

  api.tasks.loadFolder();
  next();
  
};


exports.tasks = tasks;
