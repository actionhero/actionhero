var uuid = require("node-uuid");
var domain = require("domain");

var task = function(api, next){

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
      isDuplicate: false
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
    return uuid.v4();
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
    }else if(self.isDuplicate === true){
      callback(toEnqueue);
    }else{
      api.tasks.getEnqueuedPeriodicTasks(function(err,enqueuedPeriodicTasks){
        for(var i in enqueuedPeriodicTasks){
          if(enqueuedPeriodicTasks[i] == self.name){
            toEnqueue = false; 
            break;
          }
        }
        callback(toEnqueue);
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
        if(self.runAt == null){
          self.runAt = new Date().getTime() - 1;
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
          isDuplicate: self.isDuplicate
        };
        api.tasks.setTaskData(self.id, data, function(error){
          api.tasks.placeInQueue(self.id, queue, function(){
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
    api.stats.increment("tasks:tasksRun");
    var taskDomain = domain.create();
    taskDomain.on("error", function(err){
      api.exceptionHandlers.task(taskDomain, err, api.tasks.tasks[self.name], callback);
    });
    taskDomain.run(function(){
      api.tasks.tasks[self.name].run(api, params, function(err, cont){
        self.ran = true;
        if(cont == null){cont = true;}
        // taskDomain.dispose();
        if(typeof callback == "function"){ callback(cont); }
      });
    });
  }

  next();
}

/////////////////////////////////////////////////////////////////////
// exports
exports.task = task;
