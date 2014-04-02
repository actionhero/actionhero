var os = require('os');
var NR = require('node-resque');

var resque = function(api, next){

  api.resque = {
    queue: null,
    workers: [],
    scheduler: null,
    connectionDetails: api.config.tasks.redis || {},

    _start: function(api, next){
      var self = this;
      self.startQueue(function(){
        self.startScheduler(function(){
          self.startWorkers(function(){
            next();
          });
        });
      });
    },

    _stop: function(api, next){
      var self = this;
      self.stopScheduler(function(){
        self.stopWorkers(function(){
          self.queue.end(function(){
            next();
          });
        });
      });
    },

    startQueue: function(callback){
      var self = this;
      self.queue = new NR.queue({connection: self.connectionDetails}, api.tasks.jobs, function(){
        callback();
      });
    },

    startScheduler: function(callback){
      var self = this;
      if(api.config.tasks.scheduler === true){
        self.scheduler = new NR.scheduler({connection: self.connectionDetails, timeout: api.config.tasks.timeout}, function(){
          self.scheduler.on('start',             function(){               api.log('resque scheduler started', 'info') })
          self.scheduler.on('end',               function(){               api.log('resque scheduler ended', 'info') })
          //self.scheduler.on('poll',              function(){               api.log('resque scheduler polling', 'debug') })
          self.scheduler.on('working_timestamp', function(timestamp){      api.log('resque scheduler working timestamp ' + timestamp, 'debug') })
          self.scheduler.on('transferred_job',   function(timestamp, job){ api.log('resque scheduler enqueuing job ' + timestamp, 'debug', job) })

          self.scheduler.start();

          process.nextTick(function(){
            callback();
          });
        });
      } else {
        callback();
      }
    },

    stopScheduler: function(callback){
      var self = this;
      if(self.scheduler == null){
        callback();
      } else {
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
      if(api.config.tasks.queues == null || api.config.tasks.queues.length === 0){
        callback();
      } else {
        while(i < api.config.tasks.queues.length){
          (function(i){
            var timeout = api.config.tasks.timeout;
            var name = os.hostname() + ':' + process.pid + '+' + (i+1);
            // var name = os.hostname() + ':' + process.pid;
            var worker = new NR.worker({
              connection: self.connectionDetails,
              name: name,
              queues: api.config.tasks.queues[i],
              timeout: timeout
            }, api.tasks.jobs, function(){
              worker.on('start',           function(){                   api.log('resque worker #'+(i+1)+' started (queues: ' + worker.options.queues + ')', 'info'); })
              worker.on('end',             function(){                   api.log('resque worker #'+(i+1)+' ended', 'info'); })
              worker.on('cleaning_worker', function(worker, pid){        api.log('resque cleaning old worker ' + worker, 'info'); })
              // worker.on('poll',            function(queue){              api.log('resque worker #'+(i+1)+' polling ' + queue, 'debug'); })
              worker.on('job',             function(queue, job){         api.log('resque worker #'+(i+1)+' working job ' + queue, 'debug', job); })
              worker.on('success',         function(queue, job, result){ api.log('resque worker #'+(i+1)+' job success ' + queue, 'info', {job: job, result: result}); })
              // worker.on('pause',           function(){                   api.log('resque worker #'+(i+1)+'  paused', 'debug'); })
              worker.on('error',           function(queue, job, error){ 
                api.exceptionHandlers.task(error, queue, job)
              })

              worker.workerCleanup();
              worker.start();
              self.workers[i] = worker;

              started++;
              if(started === api.config.tasks.queues.length){
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
      } else {
        var ended = 0;
        self.workers.forEach(function(worker){
          api.log('stopping worker: ' + worker.name, 'debug');
          worker.end(function(){
            ended++;
            if(ended === self.workers.length){
              self.workers = [];
              callback();
            }
          });
        });
      }
    }
  }

  if(api.resque.connectionDetails.fake == true){
    api.resque.connectionDetails.package = require('fakeredis');
  }

  next();

}

exports.resque = resque;
