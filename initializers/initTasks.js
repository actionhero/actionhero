var initTasks = function(api, next){

  /////////////////////
  // The task object //
  /////////////////////

  // required: name
  // optional: runAt, params, toAnnounce
  api.task = function(data){
    if(data == null){data = {}; }
    this.buildDefaults(data);
    this.validate();
    this.determineScope();
    this.determinePeriodic();
  }

  api.task.prototype.buildDefaults = function(data){
    this.name = data.name;
    this.id = this.generateID();
    var defaults = {
      name: null,
      id: this.generateID(),
      runAt: null,
      params: {},
      toAnnounce: true,
      queue: 'unknown',
      state: 'unknown',
      ran: false,
      isDuplicate: false,
    }
    for(var i in defaults){
      this[i] = defaults[i];
      if(data[i] != null){
        this[i] = data[i];
      }
    }
  }

  api.task.prototype.validate = function(){
    if(this.name === null){ throw new Error("name is required"); }
    if(api.tasks.tasks[this.name] == null){ throw new Error("task name, "+this.name+", not found"); }
  }

  api.task.prototype.generateID = function(){
    return api.uuid.v4();
  }

  api.task.prototype.determineScope = function(){
    this.scope = api.tasks.tasks[this.name].scope;
  }

  api.task.prototype.determinePeriodic = function(){
    this.periodic = false;
    this.frequency = null;
    if(api.tasks.tasks[this.name].frequency > 0){
      this.periodic = true;
      this.frequency = api.tasks.tasks[this.name].frequency;
    }
  }

  api.task.prototype.determinePeriodicEnqueability = function(callback){
    var self = this;
    var toEnqueue = true;
    if(self.periodic == false){
      callback(toEnqueue);
    }else{
      api.tasks.getAllTasks(api, self.name, function(err, matchedTasks){
        if(self.scope === "any"){
          if(api.utils.hashLength(matchedTasks) > 0){ toEnqueue = false; }
          callback(toEnqueue);
        }else{
          for(var i in matchedTasks){
            if(matchedTasks[i].queue == api.tasks.queues.globalQueue || matchedTasks[i].queue == api.tasks.queues.delayedQueue){
              toEnqueue = false;
              break;
            }
          }
          callback(toEnqueue);
        }
      });
    }
  }
  
  api.task.prototype.enqueue = function(queue, callback){
    if(callback == null && typeof queue == 'function'){
      callback = queue;
      queue = null;
    }
    var self = this;
    if(self.ran == true){
      self.runAt = null;
      self.ran = false;
    }
    self.determinePeriodicEnqueability(function(toEnqueue){
      if(toEnqueue){
        if(queue == null){
          queue = api.tasks.queues.globalQueue;
        }
        self.state = 'pending';
        if( self.runAt != null && self.runAt > new Date().getTime() ){
          queue = api.tasks.queues.delayedQueue;
          self.state = 'delayed';
        }
        if( self.periodic == true && self.runAt == null ){
          queue = api.tasks.queues.delayedQueue;
          self.state = 'delayed';
          self.runAt = new Date().getTime() + self.frequency;
        }
        var data = {
          id: self.id, 
          name: self.name, 
          periodic: self.periodic, 
          frequency: self.frequency, 
          scope: self.scope, 
          params: self.params, 
          runAt: self.runAt, 
          toAnnounce: self.toAnnounce,
          enqueuedAt: new Date().getTime(),
          state: self.state,
          queue: queue,
          isDuplicate: self.isDuplicate,
        };
        api.tasks.setTaskData(api, self.id, data, function(error){
          api.tasks.placeInQueue(api, self.id, queue, function(){
            if(typeof callback == "function"){ callback(null, true); }
          });
        });
      }else{
        if(typeof callback == "function"){ callback(new Error("not enquing periodic task "+self.name+": already in the queue"), null); }
      }
    })
  }

  api.task.prototype.duplicate = function(){
    var data = {};
    for(var i in this){
      if(typeof this[i] != "function"){
        data[i] = this[i];
      }
    }
    var newTask = new api.task(data);
    newTask.isDuplicate = true;
    newTask.id = newTask.generateID();
    return newTask;
  }

  api.task.prototype.run = function(callback){
    var self = this;
    var params = self.params;
    api.stats.increment(api, "tasks:tasksRun");
    if(api.domain != null){
      var taskDomain = api.domain.create();
      taskDomain.on("error", function(err){
        api.exceptionHandlers.task(taskDomain, err, api.tasks.tasks[self.name], callback);
      });
      taskDomain.run(function(){
        api.tasks.tasks[self.name].run(api, params, function(err, cont){
          self.ran = true;
          if(cont == null){cont = true;}
          if(typeof callback == "function"){ callback(cont); }
        });
      })
    }else{
      api.tasks.tasks[self.name].run(api, params, function(err, cont){
        self.ran = true;
        if(cont == null){cont = true;}
        if(typeof callback == "function"){ callback(cont); }
      });
    }
  }

  /////////////////////////
  // The task processors //
  /////////////////////////

  api.taskProcessor = function(data){
    if(data == null){data = {}; }
    this.buildDefaults(data);
  }

  api.taskProcessor.prototype.buildDefaults = function(data){
    if(data.id == null){ throw new Error("taskProcessors need an id"); }
    var defaults = {
      id: data.id,
      cycleTimeMS: api.tasks.cycleTimeMS,
      currentTask: null,
      timer: null,
      running: false
    }
    for(var i in defaults){
      this[i] = defaults[i];
      if(data[i] != null){
        this[i] = data[i];
      }
    }
  }

  api.taskProcessor.prototype.log = function(message){
    api.log("[taskProcessor "+this.id+"] " + message, "yellow");
  }

  api.taskProcessor.prototype.process = function(callback){
    var self = this;
    clearTimeout(self.timer);
    api.tasks.queueLength(api, api.tasks.queues.globalQueue, function(err, globalQueueCount){
      api.tasks.queueLength(api, api.tasks.queues.localQueue, function(err, localQueueCount){
        api.tasks.queueLength(api, api.tasks.queues.delayedQueue, function(err, delayedQueueCount){
          // console.log({
          //   delayedQueueCount: delayedQueueCount,
          //   globalQueueCount: globalQueueCount,
          //   localQueueCount: localQueueCount,
          // });

          if(localQueueCount > 0){

            // work something from the local queue to processing, and work it off
            api.tasks.changeQueue(api, api.tasks.queues.localQueue, api.tasks.queues.processingQueue, function(err, task){
              if(task == null){
                self.prepareNextRun();
                if(typeof callback == "function"){ callback(); }
              }else{
                self.currentTask = task;
                api.tasks.setTaskData(api, task.id, {api_id: api.id, worker_id: self.id, state: "processing"}, function(){
                  if(task.toAnnounce != false){ self.log("starting task " + task.name); }
                  task.run(function(){
                    api.tasks.removeFromQueue(api, task.id, api.tasks.queues.processingQueue, function(){
                      self.log("completed task " + task.name + ", " + task.id);
                      if(task.periodic == true && task.isDuplicate === false){
                        task.runAt = null;
                        task.enqueue(function(error){
                          if(error != null){ self.log(error); }
                          self.prepareNextRun();
                          if(typeof callback == "function"){ callback(); }
                        });
                      }else{
                        self.prepareNextRun();
                        if(typeof callback == "function"){ callback(); }
                      }
                    });
                  });
                });
              }
            });

          }else if(globalQueueCount > 0){

            // move something from the global queue to the local queue (and distribute if needed)
            api.tasks.changeQueue(api, api.tasks.queues.globalQueue, api.tasks.queues.localQueue, function(err, task){
              if(task == null){
                self.prepareNextRun();
                if(typeof callback == "function"){ callback(); }
              }else{
                self.currentTask = task;
                // if(task.toAnnounce != false){ self.log("preparing task " + task.name + " to run locally"); }
                api.tasks.copyToReleventLocalQueues(api, task, function(){
                  self.prepareNextRun();
                  if(typeof callback == "function"){ callback(); }
                });
              }
            });

          }else if(delayedQueueCount > 0){

            // move something from the delayed queue to the global queue if ready
            api.tasks.promoteFromDelayedQueue(api, function(err, task){
              if(task == null){
                self.prepareNextRun();
                if(typeof callback == "function"){ callback(); }
              }else{    
                self.currentTask = task;
                // if(task.toAnnounce != false){ self.log("promoted delayed task " + task.name + " to the global queue"); }
                self.prepareNextRun();
                if(typeof callback == "function"){ callback(); }
              }
            });

          }else{

            // nothing to do
            self.prepareNextRun();
            if(typeof callback == "function"){ callback(); }
          }

        });
      });
    });
  }

  api.taskProcessor.prototype.prepareNextRun = function(){
    var self = this;
    self.currentTask = null;
    if(self.running == true){
      self.timer = setTimeout(function(){
        self.process();
      }, self.cycleTimeMS);
    }
  }

  api.taskProcessor.prototype.start = function(){
    this.running = true
    this.process();
  }

  api.taskProcessor.prototype.stop = function(){
    this.running = false;
    clearTimeout(this.timer);
  }

  //////////////////////////
  // The tasks themselves //
  //////////////////////////

  api.tasks = {};
  api.tasks.tasks = {};
  api.tasks.taskProcessors = [];
  api.tasks.cycleTimeMS = 1000;

  api.tasks.queues = {
    globalQueue: 'actionHero:tasks:global',
    delayedQueue: 'actionHero:tasks:delayed',
    localQueue: 'actionHero:tasks:' + api.id.replace(/:/g,'-'),
    processingQueue: 'actionHero:tasks:processing',
    data: 'actionHero:tasks:data', // actually a hash
  }

  if(api.redis.enable === true){
    //
  }else{
    api.tasks.queueData = {};
    api.tasks.queueData[api.tasks.queues.globalQueue] = [];
    api.tasks.queueData[api.tasks.queues.delayedQueue] = [];
    api.tasks.queueData[api.tasks.queues.localQueue] = [];
    api.tasks.queueData[api.tasks.queues.processingQueue] = [];
    api.tasks.queueData[api.tasks.queues.data] = {};
  }

  api.tasks._start = function(api, next){
    api.tasks.savePreviouslyCrashedTasks(function(){
      api.tasks.seedPeriodicTasks(function(){
        var i = 0;
        api.log("starting "+api.configData.general.workers+" task timers", "yellow")
        while(i < api.configData.general.workers){
          (function(){
            var taskProcessor = new api.taskProcessor({id: i});
            api.tasks.taskProcessors[i] = taskProcessor;
            var timer = i * 50;
            setTimeout(function(){ taskProcessor.start(); }, timer)
          })()
          i++;
        }
        next();
      });
    });
  }

  api.tasks._teardown = function(api, next){
    api.tasks.taskProcessors.forEach(function(taskProcessor){
      taskProcessor.stop();
    })
    next();
  }

  api.tasks.getAllLocalQueues = function(api, callback){
    if(api.redis.enable === true){
      api.redis.client.lrange("actionHero:peers",0,-1,function(err,peers){
        var allLocalQueues = [];
        for(var i in peers){
          allLocalQueues.push("actionHero:tasks:" + peers[i].replace(/:/g,"-"));
        }
        if(typeof callback == "function"){ callback(null, allLocalQueues); }
      });
    }
  }

  api.tasks.copyToReleventLocalQueues = function(api, task, callback){
    if(api.redis.enable === true){
      api.tasks.getAllLocalQueues(api, function(err, allLocalQueues){
        var releventLocalQueues = []
        if(task.scope == "any"){
          // already moved
        }else{
          releventLocalQueues = allLocalQueues
        }
        if(releventLocalQueues.length == 0){
          if(typeof callback == "function"){ callback(); }
        }else{
          var started = 0;
          for(var i in releventLocalQueues){
            started++;
            var queue = releventLocalQueues[i];
            if(queue != api.tasks.queues.localQueue){
              var taskCopy = task.duplicate();
              taskCopy.enqueue(queue, function(){
                started--;
                if(started == 0){ if(typeof callback == "function"){ callback(); } }
              }); 
            }else{
              process.nextTick(function(){
                started--;
                if(started == 0){ if(typeof callback == "function"){ callback(); } }
              });
            }
          }
        }
      })
    }else{
      process.nextTick(function(){
        if(typeof callback == "function"){ callback(); }
      });
    }
  }

  api.tasks.getAllTasks = function(api, nameToMatch, callback){
    if(callback == null && typeof nameToMatch == "function"){
      callback = nameToMatch;
      nameToMatch = null;
    }
    if(api.redis.enable === true){
      api.redis.client.hgetall(api.tasks.queues.data, function(err, data){
        var parsedData = {}
        for(var i in data){
          parsedData[i] = JSON.parse(data[i])
        }
        if(nameToMatch == null){
          if(typeof callback == "function"){ callback(err, parsedData); }
        }else{
          var results = {};
          for(var i in parsedData){
            if(parsedData[i].name == nameToMatch){
              results[i] = parsedData[i];
            }
          }
          if(typeof callback == "function"){ callback(err, results); }
        }
      });
    }else{
      process.nextTick(function(){
        if(typeof callback == "function"){ callback(null, api.tasks.queueData[api.tasks.queues.data]); }
      });
    }
  }

  api.tasks.setTaskData = function(api, taskId, data, callback){
    if(api.redis.enable === true){
      api.tasks.getTaskData(api, taskId, function(err, muxedData){
        if(muxedData == null && err == null){
          muxedData = {};
        }
        for(var i in data){
          muxedData[i] = data[i];
        }
        api.redis.client.hset(api.tasks.queues.data, taskId, JSON.stringify(muxedData), function(err){
          if(typeof callback == "function"){ callback(err, muxedData); }
        });
      });
    }else{
      var muxedData = api.tasks.queueData[api.tasks.queues.data][taskId];
      if(muxedData == null){ muxedData = {}; }
      for(var i in data){
        muxedData[i] = data[i];
      }
      api.tasks.queueData[api.tasks.queues.data][taskId] = muxedData;
      process.nextTick(function(){
        if(typeof callback == "function"){ callback(null, muxedData); }
      });
    }
  }

  api.tasks.getTaskData = function(api, taskId, callback){
    if(api.redis.enable === true){
      api.redis.client.hget(api.tasks.queues.data, taskId, function(err, data){
        try{
          data = JSON.parse(data);
        }catch(e){ 
          data = {}; 
        }
        if(typeof callback == "function"){ callback(err, data); }
      });
    }else{
      process.nextTick(function(){
        if(typeof callback == "function"){ callback(null, api.tasks.queueData[api.tasks.queues.data][taskId]); }
      });
    }
  }

  api.tasks.clearTaskData = function(api, taskId, callback){
    if(api.redis.enable === true){
      api.redis.client.hdel(api.tasks.queues.data, taskId, function(err){
        if(typeof callback == "function"){ callback(err); }
      });
    }else{
      delete api.tasks.queueData[api.tasks.queues.data][taskId];
      process.nextTick(function(){
        if(typeof callback == "function"){ callback(null); }
      });
    }
  }

  api.tasks.placeInQueue = function(api, taskId, queue, callback){
    api.tasks.setTaskData(api, taskId, {queue: queue}, function(err){
      if(api.redis.enable === true){
        api.redis.client.rpush(queue, taskId, function(err){
          if(typeof callback == "function"){ callback(err); }
        });
      }else{
        process.nextTick(function(){
          api.tasks.queueData[queue].push(taskId);
          if(typeof callback == "function"){ callback(null); }
        });
      }
    });
  }

  api.tasks.queueLength = function(api, queue, callback){
    if(api.redis.enable === true){
      api.redis.client.llen(queue, function(err, length){
        if(typeof callback == "function"){ callback(err, length); }
      });
    }else{
      process.nextTick(function(){
        if(typeof callback == "function"){ callback(null, api.tasks.queueData[queue].length); }
      });
    }
  }

  api.tasks.removeFromQueue = function(api, taskId, queue, callback){
    api.tasks.clearTaskData(api, taskId, function(err){
      if(api.redis.enable === true){
        api.redis.client.lrem(queue, 1, taskId, function(err, count){
          if(typeof callback == "function"){ callback(err, count); }
        });
      }else{
        var queueData = api.tasks.queueData[queue];
        for(var i in queueData){
          if(queueData[i].id == taskId){
            queueData.splice(i,1);
            break;
          }
        }
        if(typeof callback == "function"){ callback(null, 0); }
      }
    });
  }

  api.tasks.popFromQueue = function(api, queue, callback){
    if(api.redis.enable === true){
      api.redis.client.lpop(queue, function(err, taskIdReturned){
        callback(err, taskIdReturned);
      });
    }else{
      process.nextTick(function(){ 
        var queueData = api.tasks.queueData[queue];
        taskIdReturned = queueData.splice(0,1)[0];
        if(taskIdReturned == null){ taskIdReturned = null; }
        callback(null, taskIdReturned); 
      })
    }
  }

  api.tasks.changeQueue = function(api, startQueue, endQueue, callback){
    api.tasks.popFromQueue(api, startQueue, function(err, taskIdReturned){
      if(taskIdReturned == null){
        callback(err, null);
      }else{
        api.tasks.placeInQueue(api, taskIdReturned, endQueue, function(err){
          api.tasks.getTaskData(api, taskIdReturned, function(err, data){
            try{
              var task = new api.task(data)
              callback(err, task);
            }catch(e){
              api.log(e, 'red');
              api.tasks.removeFromQueue(api, data.id, endQueue, function(){
                callback(err, null);
              });
            }
          });
        });
      }
    });
  }

  api.tasks.promoteFromDelayedQueue = function(api, callback){
    api.tasks.popFromQueue(api, api.tasks.queues.delayedQueue, function(err, taskIdReturned){
      if(taskIdReturned == null){
        callback(err, null);
      }else{
        api.tasks.getTaskData(api, taskIdReturned, function(err, data){
          try{
            var task = new api.task(data);
            if(task.runAt < new Date().getTime()){
              api.tasks.setTaskData(api, taskIdReturned, {state: 'pending'}, function(err){
                api.tasks.placeInQueue(api, taskIdReturned, api.tasks.queues.globalQueue, function(err){
                  callback(err, task);
                });
              });
            }else{
              api.tasks.placeInQueue(api, taskIdReturned, api.tasks.queues.delayedQueue, function(err){
                callback(err, null);
              });
            }
          }catch(e){
            api.log(e, 'red');
            api.tasks.removeFromQueue(api, data.id, api.tasks.queues.delayedQueue, function(){
              callback(err, null);
            });
          }
        });
      }
    });
  }

  api.tasks.seedPeriodicTasks = function(callback){
    if(api.tasks.tasks.length == 0){
      callback();
    }else{
      var started = 0;
      for(var i in api.tasks.tasks){
        started++;
        var taskTemplate = api.tasks.tasks[i];
        if(taskTemplate.frequency > 0){
          var task = new api.task({name: taskTemplate.name});
          task.enqueue(function(err, resp){
            if(err != null){ 
              api.log(String(err).replace('Error: ', ""), 'yellow'); 
            }else{
              api.log("seeded preiodoc task " + task.name, "yellow");
            }
            process.nextTick(function(){ 
              started--;
              if(started == 0){ callback(); }
            })
          });
        }else{
          process.nextTick(function(){ 
            started--;
            if(started == 0){ callback(); }
          })
        }
      }
    }
  }

  api.tasks.savePreviouslyCrashedTasks = function(callback){
    api.tasks.changeQueue(api, api.tasks.queues.processingQueue, api.tasks.queues.globalQueue, function(err, task){
      if(task != null){
        api.log('restarting a previously interupted/crashed task ' + task.name, 'yellow');
        api.tasks.savePreviouslyCrashedTasks(callback);
      }else{
        callback();
      }
    });
  }

  api.tasks.load = function(api){
    var validateTask = function(api, task){
      var fail = function(msg){
        api.log(msg + "; exiting.", ['red', 'bold']);
        process.exit();
      }
      if(typeof task.name != "string" && task.name.length < 1){
        fail("a task is missing `task.name`");
      }else if(typeof task.description != "string" && task.name.description < 1){
        fail("Task "+task.name+" is missing `task.description`");
      }else if(typeof task.scope != "string"){
        fail("Task "+task.name+" has no scope");
      }else if(typeof task.frequency != "number"){
        fail("Task "+task.name+" has no frequency");  
      }else if(typeof task.run != "function"){
        fail("Task "+task.name+" has no run method");
      }
    }
    
    var loadFolder = function(path){
      if(api.fs.existsSync(path)){
        api.fs.readdirSync(path).forEach( function(file) {
          if(path[path.length - 1] != "/"){ path += "/"; } 
          var fullfFilePath = path + file;
          if (file[0] != "."){
            var stats = api.fs.statSync(fullfFilePath);
            if(stats.isDirectory()){
              loadFolder(fullfFilePath);
            }else if(stats.isSymbolicLink()){
              var realPath = readlinkSync(fullfFilePath);
              loadFolder(realPath);
            }else if(stats.isFile()){
              taskLoader(api, fullfFilePath)
            }else{
              api.log(file+" is a type of file I cannot read", "red")
            }
          }
        });
      }else{
        api.log("No tasks folder found, skipping...");
      }
    }

    var taskLoader = function(api, fullfFilePath, reload){
      if(reload == null){ reload = false; }

      var loadMessage = function(loadedTaskName){
        if(reload){
          loadMessage = "task (re)loaded: " + loadedTaskName + ", " + fullfFilePath;
        }else{
          var loadMessage = "task loaded: " + loadedTaskName + ", " + fullfFilePath;
        }
        api.log(loadMessage, "yellow");
      }

      var parts = fullfFilePath.split("/");
      var file = parts[(parts.length - 1)];
      var taskName = file.split(".")[0];
      if(!reload){
        if(api.configData.general.developmentMode == true){
          api.watchedFiles.push(fullfFilePath);
          (function() {
            api.fs.watchFile(fullfFilePath, {interval:1000}, function(curr, prev){
              if(curr.mtime > prev.mtime){
                process.nextTick(function(){
                  if(api.fs.readFileSync(fullfFilePath).length > 0){
                    delete require.cache[fullfFilePath];
                    delete api.tasks.tasks[taskName];
                    taskLoader(api, fullfFilePath, true);
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
          validateTask(api, api.tasks.tasks[taskName]);
          loadMessage(taskName);
        }else{
          for(var i in collection){
            var task = collection[i];
            api.tasks.tasks[task.name] = task;
            validateTask(api, api.tasks.tasks[task.name]);
            loadMessage(task.name);
          }
        }
      }catch(err){
        api.exceptionHandlers.loader(fullfFilePath, err);
        delete api.tasks.tasks[taskName];
      }
    }

    var taskFolders = [ 
      process.cwd() + "/tasks/", 
    ]

    for(var i in taskFolders){
      loadFolder(taskFolders[i]);
    }
  }

  api.tasks.load(api); // run right away
  next();

}

/////////////////////////////////////////////////////////////////////
// exports
exports.initTasks = initTasks;
