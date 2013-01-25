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
  }

  api.taskProcessor._teardown = function(api, next){
    api.tasks.taskProcessors.forEach(function(taskProcessor){
      taskProcessor.stop();
    });
    // TODO: don't return until each worker is actually done
    next();
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
    self.setWorkerStatus("warming", function(){
      api.tasks.queueLength(api.tasks.queues.globalQueue, function(err, globalQueueCount){
        api.tasks.queueLength(api.tasks.queues.localQueue, function(err, localQueueCount){
          // console.log({
          //   globalQueueCount: globalQueueCount,
          //   localQueueCount: localQueueCount,
          // });
          if(localQueueCount > 0){
            // work something from the local queue to processing, and work it off
            if(task == null){
              self.prepareNextRun(callback);
            }else{
              self.currentTask = task;
              self.setWorkerStatus("working task: " + task.id, function(){
                api.tasks.setTaskData(task.id, {api_id: api.id, worker_id: self.id, state: "processing"}, function(){
                  if(task.toAnnounce != false){ self.log("starting task " + task.name); }
                  api.stats.increment("tasks:tasksCurrentlyRunning");
                  api.stats.increment("tasks:ranTasks:" + task.name);
                  task.run(function(){
                    api.stats.increment("tasks:tasksCurrentlyRunning", -1);
                    if(task.toAnnounce != false){ self.log("completed task " + task.name + ", " + task.id); }
                    if(task.periodic == true && task.isDuplicate === false){
                      task.runAt = null;
                      api.tasks.denotePeriodicTaskAsClear(task, function(){
                        task.enqueue(function(error){
                          api.tasks.denotePeriodicTaskAsEnqueued(function(error){
                            if(error != null){ self.log(error); }
                            self.prepareNextRun(callback);
                          });
                        });
                      });
                    }else{
                      self.prepareNextRun(callback);
                    }
                  });
                });
              });
            }
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
              api.tasks.promoteFromDelayedQueue(function(){
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
    if(self.running == true){
      self.timer = setTimeout(function(){
        self.process();
      }, self.cycleTimeMS);
    }
    self.setWorkerStatus("idle", function(){
      if(typeof callback == "function"){ callback(); }
    })
  }

  api.taskProcessor.prototype.start = function(){
    this.running = true
    this.process();
    self.setWorkerStatus("started");
  }

  api.taskProcessor.prototype.stop = function(){
    this.running = false;
    self.setWorkerStatus("stopped");
    clearTimeout(this.timer);
  }

  api.taskProcessor.prototype.setWorkerStatus = function(status, callback){
    var self = this;
    var workerKey = api.id + "#" + self.id
    if(api.redis.enable === true){
      api.redis.client.hset(api.tasks.queues.workerStatus, workerKey, status, function(err){
        callback(err);
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
