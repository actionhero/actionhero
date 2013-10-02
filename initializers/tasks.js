var fs = require('fs');

var tasks = function(api, next){

  api.tasks = {

    tasks: {},
    jobs: {},

    _start: function(api, next){
      next();
    },

    _teardown: function(api, next){
      next();
    },

    tasksPath: function(){
      return process.cwd() + "/tasks/";
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

      var parts = fullfFilePath.split("/");
      var file = parts[(parts.length - 1)];
      var taskName = file.split(".")[0];
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
                    delete api.tasks.tasks[taskName]
                    delete api.tasks.jobs[taskName]
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
        if(api.utils.hashLength(collection) == 1){
          api.tasks.tasks[taskName] = require(fullfFilePath).task;
          self.validateTask(api.tasks.tasks[taskName]);
          api.tasks.jobs[taskName] = self.jobWrapper(taskName);
          loadMessage(taskName);
        }else{
          for(var i in collection){
            var task = collection[i];
            api.tasks.tasks[task.name] = task;
            self.validateTask(api.tasks.tasks[task.name]);
            api.tasks.jobs[taskName] = self.jobWrapper(taskName);
            loadMessage(task.name);
          }
        }
      }catch(err){
        api.exceptionHandlers.loader(fullfFilePath, err);
        delete api.tasks.tasks[taskName];
        delete api.tasks.jobs[taskName];
      }
    },

    jobWrapper: function(taskName){
      var self = this;
      return function(){
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
      }else if(typeof task.queue != "string"){
        fail("Task "+task.name+" has no queue");
      }else if(typeof task.frequency != "number"){
        fail("Task "+task.name+" has no frequency");  
      }else if(typeof task.run != "function"){
        fail("Task "+task.name+" has no run method");
      }
    },
    
    loadFolder: function(path){
      var self = this;
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

    enqueue: function(taskName, params, callback){
      if(typeof params === "function" && callback == null){ callback = params; params = {}; }
      var queue = this.tasks[taskName].queue;
      api.resque.queue.enqueue(queue, taskName, params, callback);
    },

    enqueueAt: function(timestamp, taskName, params, callback){
      if(typeof params === "function" && callback == null){ callback = params; params = {}; }
      var queue = this.tasks[taskName].queue;
      api.resque.queue.enqueueAt(timestamp, queue, taskName, params, callback);
    },

    enqueueIn: function(time, taskName, params, callback){
      if(typeof params === "function" && callback == null){ callback = params; params = {}; }
      var queue = this.tasks[taskName].queue;
      api.resque.queue.enqueueIn(time, queue, taskName, params, callback);
    },

    enqueueRecurrentJob: function(taskName, callback){
      var self = this;
      var task = self.tasks[taskName];
      if(task.frequency <= 0){
        callback();
      }else{
        // TODO: Uniquify and 'claim' recurrent jobs?
        self.enqueueIn(task.frequency, taskName, function(){
          api.log("re-enqueued reccurent job " + taskName, "debug");
          callback();
        });
      }
    },

  }

  api.tasks.loadFolder(api.tasks.tasksPath());
  next();
};

exports.tasks = tasks;