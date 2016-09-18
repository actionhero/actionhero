'use strict';

var NR = require('node-resque');

module.exports = {
  startPriority: 200,
  stopPriority:  100,
  loadPriority:  600,
  initialize: function(api, next){

    var resqueOverrides = api.config.tasks.resque_overrides;

    api.resque = {
      verbose: false,
      queue: null,
      multiWorker: null,
      scheduler: null,
      connectionDetails: {redis: api.redis.clients.tasks},

      startQueue: function(callback){
        var self = this;
        var queue = NR.queue;
        if(resqueOverrides && resqueOverrides.queue){ queue = resqueOverrides.queue; }
        self.queue = new queue({connection: self.connectionDetails}, api.tasks.jobs);
        self.queue.on('error', function(error){
          api.log(error, 'error', '[api.resque.queue]');
        });
        self.queue.connect(callback);
      },

      stopQueue: function(callback){
        if(api.resque.queue){ api.resque.queue.end(callback); }
        else{ callback(); }
      },

      startScheduler: function(callback){
        var self = this;
        var scheduler = NR.scheduler;
        if(resqueOverrides && resqueOverrides.scheduler){ scheduler = resqueOverrides.scheduler; }
        if(api.config.tasks.scheduler === true){
          self.schedulerLogging = api.config.tasks.schedulerLogging;
          self.scheduler = new scheduler({connection: self.connectionDetails, timeout: api.config.tasks.timeout});
          self.scheduler.on('error', function(error){
            api.log(error, 'error', '[api.resque.scheduler]');
          });
          self.scheduler.connect(function(){
            self.scheduler.on('start',             function(){               api.log('resque scheduler started', self.schedulerLogging.start); });
            self.scheduler.on('end',               function(){               api.log('resque scheduler ended', self.schedulerLogging.end); });
            self.scheduler.on('poll',              function(){               api.log('resque scheduler polling', self.schedulerLogging.poll); });
            self.scheduler.on('working_timestamp', function(timestamp){      api.log(['resque scheduler working timestamp %s', timestamp], self.schedulerLogging.working_timestamp); });
            self.scheduler.on('transferred_job',   function(timestamp, job){ api.log(['resque scheduler enqueuing job %s', timestamp], self.schedulerLogging.transferred_job, job); });
            self.scheduler.on('master',            function(state){          api.log(['This node is now the Resque scheduler master']); });

            self.scheduler.start();
            callback();
          });
        }else{
          callback();
        }
      },

      stopScheduler: function(callback){
        var self = this;
        if(!self.scheduler){
          callback();
        }else{
          self.scheduler.end(function(){
            delete self.scheduler;
            callback();
          });
        }
      },

      startMultiWorker: function(callback){
        var self = this;
        var multiWorker = NR.multiWorker;
        if(resqueOverrides && resqueOverrides.multiWorker){ multiWorker = resqueOverrides.multiWorker; }
        self.workerLogging = api.config.tasks.workerLogging;
        self.schedulerLogging = api.config.tasks.schedulerLogging;

        self.multiWorker = new multiWorker({
          connection:             api.resque.connectionDetails,
          queues:                 api.config.tasks.queues,
          timeout:                api.config.tasks.timeout,
          checkTimeout:           api.config.tasks.checkTimeout,
          minTaskProcessors:      api.config.tasks.minTaskProcessors,
          maxTaskProcessors:      api.config.tasks.maxTaskProcessors,
          maxEventLoopDelay:      api.config.tasks.maxEventLoopDelay,
          toDisconnectProcessors: api.config.tasks.toDisconnectProcessors,
        }, api.tasks.jobs);

        // normal worker emitters
        self.multiWorker.on('start',             function(workerId){                      api.log('worker: started',                 self.workerLogging.start,         {workerId: workerId}); });
        self.multiWorker.on('end',               function(workerId){                      api.log('worker: ended',                   self.workerLogging.end,           {workerId: workerId}); });
        self.multiWorker.on('cleaning_worker',   function(workerId, worker, pid){         api.log(['worker: cleaning old worker %s, (%s)', worker, pid],  self.workerLogging.cleaning_worker); });
        self.multiWorker.on('poll',              function(workerId, queue){               api.log(['worker: polling %s', queue],     self.workerLogging.poll,          {workerId: workerId}); });
        self.multiWorker.on('job',               function(workerId, queue, job){          api.log(['worker: working job %s', queue], self.workerLogging.job,           {workerId: workerId, job: {class: job['class'], queue: job.queue}}); });
        self.multiWorker.on('reEnqueue',         function(workerId, queue, job, plugin){  api.log('worker: reEnqueue job',           self.workerLogging.reEnqueue,     {workerId: workerId, plugin: plugin, job: {class: job['class'], queue: job.queue}}); });
        self.multiWorker.on('success',           function(workerId, queue, job, result){  api.log(['worker: job success %s', queue], self.workerLogging.success,       {workerId: workerId, job: {class: job['class'], queue: job.queue}, result: result}); });
        self.multiWorker.on('pause',             function(workerId){                      api.log('worker: paused',                  self.workerLogging.pause,         {workerId: workerId}); });

        self.multiWorker.on('failure',           function(workerId, queue, job, failure){ api.exceptionHandlers.task(failure, queue, job, workerId); });
        self.multiWorker.on('error',             function(workerId, queue, job, error){   api.exceptionHandlers.task(error, queue, job, workerId);   });

        // multiWorker emitters
        self.multiWorker.on('internalError',     function(error){                         api.log(error, self.workerLogging.internalError); });
        self.multiWorker.on('multiWorkerAction', function(verb, delay){                   api.log(['*** checked for worker status: %s (event loop delay: %sms)', verb, delay], self.workerLogging.multiWorkerAction); });

        if(api.config.tasks.minTaskProcessors > 0){
          self.multiWorker.start(function(){
            if(typeof callback === 'function'){ callback(); }
          });
        }else{
          if(typeof callback === 'function'){ callback(); }
        }
      },

      stopMultiWorker: function(callback){
        var self = this;
        if(self.multiWorker && api.config.tasks.minTaskProcessors > 0){
          self.multiWorker.stop(function(){
            api.log('task workers stopped');
            callback();
          });
        }else{
          callback();
        }
      }
    };

    next();
  },

  start: function(api, next){
    if(api.config.tasks.minTaskProcessors === 0 && api.config.tasks.maxTaskProcessors > 0){
      api.config.tasks.minTaskProcessors = 1;
    }

    api.resque.startQueue(function(){
      api.resque.startScheduler(function(){
        api.resque.startMultiWorker(function(){
          next();
        });
      });
    });
  },

  stop: function(api, next){
    api.resque.stopScheduler(function(){
      api.resque.stopMultiWorker(function(){
        api.resque.stopQueue(function(){
          next();
        });
      });
    });
  },
};
