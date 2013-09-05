var taskProcessor = function(api, next){

  /////////////////////////
  // The task processors //
  /////////////////////////

  api.taskProcessor = function(data){
    if(data == null){data = {}; }
    this.buildDefaults(data);
  }

  api.taskProcessor._start = function(api, next){
    var i = 0;
    api.log("starting "+api.configData.general.workers+" task timers", "notice")
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
  }

  api.taskProcessor._teardown = function(api, next){
    var numberOfWorkersWorking = 0
    api.tasks.taskProcessors.forEach(function(taskProcessor){
      taskProcessor.stop();
      if(taskProcessor.currentTask != null){
        numberOfWorkersWorking++;
      }
    });
    if(numberOfWorkersWorking > 0){
      api.log("Delaying shutdown, there are still " + numberOfWorkersWorking + " workers working...", "notice");
      setTimeout(function(){
        api.taskProcessor._teardown(api, next);
      }, 1000);
    }else{
      next();
    }
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

  api.taskProcessor.prototype.log = function(message, severity, data){
    if(severity == null){ severity = 'info'; }
    api.log("[taskProcessor "+this.id+"] " + message, severity, data);
  }

  api.taskProcessor.prototype.process = function(callback){
    var self = this;
    clearTimeout(self.timer);
    self.processLocalQueue(function(){
      self.processGlobalQueue(function(){
        self.processDelayedQueue(function(){
          if(self.running == true){
            self.setWorkerStatus("idle", function(){
              self.timer = setTimeout(function(){
                self.process();
              }, self.cycleTimeMS) 
              if(typeof callback == "function"){ callback(); }
            });
          }else{
            if(typeof callback == "function"){ callback(); }
          }
        });
      });
    });
  }

  api.taskProcessor.prototype.processLocalQueue = function(callback){
    var self = this;
    if(api.running){
      self.setWorkerStatus("warming:local", function(){
        api.tasks.popFromQueue(api.tasks.queues.localQueue, function(err, taskIdReturned){
          if(err != null){
            callback(err, null);
          }else if(taskIdReturned == null){
            callback(null, null);
          }else{
            api.tasks.getTaskData(taskIdReturned, function(err, data){
              self.currentTask = new api.task(data);
              var startTime = new Date().getTime();
              self.setWorkerStatus("working task: " + self.currentTask.id, function(){
                api.tasks.setTaskData(self.currentTask.id, {api_id: api.id, worker_id: self.id, state: "processing"}, function(){
                  if(self.currentTask.toAnnounce != false){ self.log("starting task " + self.currentTask.name + ", " + self.currentTask.id, 'notice', self.currentTask.params); }
                  api.stats.increment("tasks:tasksCurrentlyRunning");
                  api.stats.increment("tasks:ranTasks:" + self.currentTask.name);
                  self.currentTask.run(function(){
                    api.stats.increment("tasks:tasksCurrentlyRunning", -1);
                    if(self.currentTask != null){
                      var deltaSeconds = Math.round((new Date().getTime() - startTime) / 1000)
                      if(self.currentTask.toAnnounce != false){ self.log("completed task " + self.currentTask.name + " (" + deltaSeconds + "s), " + self.currentTask.id); }
                      if(self.currentTask.periodic == true && self.currentTask.isDuplicate === false){
                        self.currentTask.runAt = null;
                        api.tasks.denotePeriodicTaskAsClear(self.currentTask, function(){
                          self.currentTask.enqueue(function(error){
                            api.tasks.denotePeriodicTaskAsEnqueued(self.currentTask, function(error){
                              if(error != null){ self.log(error); }
                              delete self.currentTask;
                              callback(null, taskIdReturned);
                            });
                          });
                        });
                      }else{
                        api.tasks.clearTaskData(self.currentTask.id, function(){
                          delete self.currentTask;
                          callback(null, taskIdReturned);
                        });
                      }
                    }
                  });
                });
              });
            });
          }
        });
      });
    }else{
      callback();
    }
  }

  api.taskProcessor.prototype.processGlobalQueue = function(callback){
    var self = this;
    if(api.running){
      self.setWorkerStatus("warming:global", function(){
        api.tasks.changeQueue(api.tasks.queues.globalQueue, api.tasks.queues.localQueue, function(err, task){
          if(task == null){
            callback(null, null);
          }else{
            self.currentTask = task;
            api.tasks.copyToReleventLocalQueues(task, function(){
              delete self.currentTask;
              callback(null, task.id);
            });
          }
        });
      });
    }else{
      callback();
    }
  }
  
  api.taskProcessor.prototype.processDelayedQueue = function(callback){
    var self = this;
    if(api.running){
      self.setWorkerStatus("warming:delayed", function(){
        self.setWorkerStatus("checking delayed queue", function(){
          api.tasks.promoteFromDelayedQueue(function(err, task){
            if(task != null){ 
              self.currentTask = task;
              if(self.currentTask.toAnnounce != false){
                self.log("time to process delayed task: " + task.name + " ( " + task.id + " )", "debug");
              } 
              delete self.currentTask;
              callback(null, task.id);
            }else{
              callback(null, null);
            }
          });
        });
      });
    }else{
      callback();
    }
  }

  api.taskProcessor.prototype.start = function(){
    this.running = true
    this.process();
    this.setWorkerStatus("started");
  }

  api.taskProcessor.prototype.stop = function(){
    this.running = false;
    this.setWorkerStatus("stopped");
    clearTimeout(this.timer);
  }

  api.taskProcessor.prototype.setWorkerStatus = function(status, callback){
    var self = this;
    var workerKey = api.id + "#" + self.id
    api.redis.client.hset(api.tasks.queues.workerStatus, workerKey, status, function(err){
      if(typeof callback == "function"){ callback(); }
    });
  }

  next();
}

/////////////////////////////////////////////////////////////////////
// exports
exports.taskProcessor = taskProcessor;
