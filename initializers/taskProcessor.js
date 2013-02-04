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

  api.taskProcessor.prototype.log = function(message, severity){
    if(severity == null){ severity = 'info'; }
    api.log("[taskProcessor "+this.id+"] " + message, severity);
  }

  api.taskProcessor.prototype.process = function(callback){
    var self = this;
    clearTimeout(self.timer);
    self.setWorkerStatus("warming", function(){
      api.tasks.queueLength(api.tasks.queues.globalQueue, function(err, globalQueueCount){
        api.tasks.queueLength(api.tasks.queues.localQueue, function(err, localQueueCount){
          // console.log({
          //   globalQueueCount: globalQueueCount,
          //   localQueueCount: localQueueCount,
          // });
          if(localQueueCount > 0){
            // work something from the local queue to processing, and work it off
            api.tasks.popFromQueue(api.tasks.queues.localQueue, function(err, taskIdReturned){
              api.tasks.getTaskData(taskIdReturned, function(err, data){
                if(data == null){
                  self.prepareNextRun(callback);
                }else{
                  self.currentTask = new api.task(data);
                  // self.currentTask = task;
                  self.setWorkerStatus("working task: " + self.currentTask.id, function(){
                    api.tasks.setTaskData(self.currentTask.id, {api_id: api.id, worker_id: self.id, state: "processing"}, function(){
                      if(self.currentTask.toAnnounce != false){ self.log("starting task " + self.currentTask.name + ", " + self.currentTask.id); }
                      api.stats.increment("tasks:tasksCurrentlyRunning");
                      api.stats.increment("tasks:ranTasks:" + self.currentTask.name);
                      self.currentTask.run(function(){
                        api.stats.increment("tasks:tasksCurrentlyRunning", -1);
                        if(self.currentTask.toAnnounce != false){ self.log("completed task " + self.currentTask.name + ", " + self.currentTask.id); }
                        if(self.currentTask.periodic == true && self.currentTask.isDuplicate === false){
                          self.currentTask.runAt = null;
                          api.tasks.denotePeriodicTaskAsClear(self.currentTask, function(){
                            self.currentTask.enqueue(function(error){
                              api.tasks.denotePeriodicTaskAsEnqueued(self.currentTask, function(error){
                                if(error != null){ self.log(error); }
                                self.prepareNextRun(callback);
                              });
                            });
                          });
                        }else{
                          api.tasks.clearTaskData(self.currentTask.id, function(){
                            self.prepareNextRun(callback);
                          });
                        }
                      });
                    });
                  });
                }
              });
            });
          }else if(globalQueueCount > 0){
            // move something from the global queue to the local queue (and distribute if needed)
            self.setWorkerStatus("checking global queue", function(){
              api.tasks.changeQueue(api.tasks.queues.globalQueue, api.tasks.queues.localQueue, function(err, task){
                if(task == null){
                  self.prepareNextRun(callback);
                }else{
                  self.currentTask = task;
                  // if(task.toAnnounce != false){ self.log("preparing task " + task.name + " to run locally"); }
                  api.tasks.copyToReleventLocalQueues(task, function(){
                    self.prepareNextRun(callback);
                  });
                }
              });
            });
          }else{
            // nothing to do, so check on the delayed queue
            self.setWorkerStatus("checking delayed queue", function(){
              api.tasks.promoteFromDelayedQueue(function(err, task){
                if(task != null){ self.log("time to process delayed task: " + task.name + " ( " + task.id + " )", "debug"); }
                self.prepareNextRun(function(){
                  setTimeout(callback, 1000); // wait longer if there is no work to be done
                });
              });
            });
          }
        });
      });
    });
  }

  api.taskProcessor.prototype.prepareNextRun = function(callback){
    var self = this;
    self.currentTask = null;
    self.setWorkerStatus("idle", function(){
      if(self.running == true){
        self.timer = setTimeout(function(){
          self.process();
        }, self.cycleTimeMS); 
      }
      if(typeof callback == "function"){ callback(); }
    });
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
    if(api.redis.enable === true){
      api.redis.client.hset(api.tasks.queues.workerStatus, workerKey, status, function(err){
        if(typeof callback == "function"){ callback(); }
      });
    }else{
      api.tasks.queueData[api.tasks.queues.workerStatus][workerKey] = status;
      process.nextTick(function(){
        if(typeof callback == "function"){ callback(); }
      });
    }
  }

  next();
}

/////////////////////////////////////////////////////////////////////
// exports
exports.taskProcessor = taskProcessor;
