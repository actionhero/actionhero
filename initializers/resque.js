var os = require("os");
var AR = require('action_resque');

var resque = function(api, next){  

  api.resque = {
    connectionDetails: {},
    queue: null,
    workers: [],
    scheduler: null,

    _start: function(api, next){
      var self = this;
      self.connectionDetails = api.configData.tasks.redis;
      if(self.connectionDetails.fake == true){
        self.connectionDetails.package = require('fakeredis');
      }
      self.queue = new AR.queue({connection: self.connectionDetails}, api.tasks.jobs, function(){
        self.startScheduler(function(){
          self.startWorkers(function(){
            next();
          });
        });
      });
    },

    _teardown: function(api, next){
      var self = this;
      self.queue.end(function(){
        self.stopScheduler(function(){
          self.stopWorkers(function(){
            next();
          });
        });
      });
    },

    startScheduler: function(callback){
      var self = this;
      if(api.configData.tasks.scheduler === true){
        self.scheduler = new AR.scheduler({connection: self.connectionDetails, timeout: 500}, function(){
          self.scheduler.on('start',             function(){               api.log("resque scheduler started", "info"); })
          self.scheduler.on('end',               function(){               api.log("resque scheduler ended", "info");   })
          // self.scheduler.on('poll',             function(){               api.log("resque scheduler polling", "debug"); })
          self.scheduler.on('working_timestamp', function(timestamp){      api.log("resque scheduler working timestamp " + timestamp, "debug"); })
          self.scheduler.on('transfered_job',    function(timestamp, job){ api.log("resque scheduler enquing job " + timestamp, "debug", job); })

          self.scheduler.start();

          process.nextTick(function(){
            callback();
          });
        });
      }else{
        callback();
      }
    },

    stopScheduler: function(callback){
      var self = this;
      if(self.scheduler == null){
        callback();
      }else{
        self.scheduler.end(function(){
          delete self.scheduler;
          callback();
        });
      }
    },

    startWorkers: function(callback){
      var self = this;
      var i = 0;
      var started = 0;
      if(api.configData.tasks.queues == null || api.configData.tasks.queues.length === 0){
        callback();
      }else{
        while(i < api.configData.tasks.queues.length){
          (function(i){
            var name = os.hostname() + ":" + process.pid + ":" + (i+1);
            var worker = new AR.worker({connection: self.connectionDetails, name: name, queues: api.configData.tasks.queues[i]}, api.tasks.jobs, function(){
              worker.on('start',           function(){                   api.log("resque worker #"+(i+1)+" started (queues: " + worker.options.queues + ")", "info"); })
              worker.on('end',             function(){                   api.log("resque worker #"+(i+1)+" ended", "info"); })
              worker.on('cleaning_worker', function(worker, pid){        api.log("resque cleaning old worker " + worker, "info"); })
              // worker.on('poll',            function(queue){              api.log("resque worker #"+(i+1)+" polling " + queue, "debug"); })
              worker.on('job',             function(queue, job){         api.log("resque worker #"+(i+1)+" working job " + queue, "debug", job); })
              worker.on('success',         function(queue, job, result){ api.log("resque worker #"+(i+1)+" job success " + queue, "info", {job: job, result: result}); })
              worker.on('error',           function(queue, job, error){  api.log("resque worker #"+(i+1)+" job failed " + queue, "error", {job: job, error: error}); })
              // worker.on('pause',           function(){                   api.log("resque worker #"+(i+1)+"  paused", "debug"); })

              worker.workerCleanup();
              worker.start();
              self.workers[i] = worker;

              started++;
              if(started === api.configData.tasks.queues.length){
                callback();
              }
            });
          })(i)
          i++;
        }
      }
    },

    stopWorkers: function(callback){
      var self = this;
      if(self.workers.length === 0){
        callback();
      }else{
        var ended = 0;
        self.workers.forEach(function(worker){
          worker.end(function(){
            ended++;
            if(ended === self.workers.length){
              self.workers = [];
              callback();
            }
          });
        });
      }
    },  
  } 

  next();

}

exports.resque = resque;