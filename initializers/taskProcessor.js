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
    })
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
    api.tasks.queueLength(api.tasks.queues.globalQueue, function(err, globalQueueCount){
      api.tasks.queueLength(api.tasks.queues.localQueue, function(err, localQueueCount){
        api.tasks.queueLength(api.tasks.queues.delayedQueue, function(err, delayedQueueCount){
          // console.log({
          //   delayedQueueCount: delayedQueueCount,
          //   globalQueueCount: globalQueueCount,
          //   localQueueCount: localQueueCount,
          // });

          if(localQueueCount > 0){

            // work something from the local queue to processing, and work it off
            api.tasks.changeQueue(api.tasks.queues.localQueue, api.tasks.queues.processingQueue, function(err, task){
              if(task == null){
                self.prepareNextRun();
                if(typeof callback == "function"){ callback(); }
              }else{
                self.currentTask = task;
                api.tasks.setTaskData(task.id, {api_id: api.id, worker_id: self.id, state: "processing"}, function(){
                  if(task.toAnnounce != false){ self.log("starting task " + task.name); }
                  task.run(function(){
                    api.tasks.removeFromQueue(task.id, api.tasks.queues.processingQueue, function(){
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
            api.tasks.changeQueue(api.tasks.queues.globalQueue, api.tasks.queues.localQueue, function(err, task){
              if(task == null){
                self.prepareNextRun();
                if(typeof callback == "function"){ callback(); }
              }else{
                self.currentTask = task;
                // if(task.toAnnounce != false){ self.log("preparing task " + task.name + " to run locally"); }
                api.tasks.copyToReleventLocalQueues(task, function(){
                  self.prepareNextRun();
                  if(typeof callback == "function"){ callback(); }
                });
              }
            });

          }else if(delayedQueueCount > 0){

            // move something from the delayed queue to the global queue if ready
            api.tasks.promoteFromDelayedQueue(function(err, task){
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

  next();
}

/////////////////////////////////////////////////////////////////////
// exports
exports.taskProcessor = taskProcessor;
