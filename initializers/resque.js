var NR = require('node-resque');

module.exports = {
  startPriority: 200,
  stopPriority:  100,
  loadPriority:  600,
  initialize: function(api, next){

    api.resque = {
	  verbose: false,
      queue: null,
      multiWorker: null,
      scheduler: null,
      connectionDetails: api.config.tasks.redis || {},

      startQueue: function(callback){
        var self = this;
        self.queue = new NR.queue({connection: self.connectionDetails}, api.tasks.jobs);
        self.queue.on('error', function(error){
          api.log(error, 'error', '[api.resque.queue]')
        });
        self.queue.connect(callback);
      },

      startScheduler: function(callback){
        var self = this;
        if(api.config.tasks.scheduler === true){
          self.scheduler = new NR.scheduler({connection: self.connectionDetails, timeout: api.config.tasks.timeout});
          self.scheduler.on('error', function(error){
            api.log(error, 'error', '[api.resque.scheduler]')
          });
          self.scheduler.connect(function(){
            self.scheduler.on('start',             function(){               api.log('resque scheduler started', 'info') })
            self.scheduler.on('end',               function(){               api.log('resque scheduler ended', 'info') })
            self.scheduler.on('poll',              function(){               api.log('resque scheduler polling', 'debug') })
            self.scheduler.on('working_timestamp', function(timestamp){      api.log('resque scheduler working timestamp ' + timestamp, 'debug') })
            self.scheduler.on('transferred_job',   function(timestamp, job){ api.log('resque scheduler enqueuing job ' + timestamp, 'debug', job) })

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
    		self.verbose = api.config.tasks.verbose;
        
        self.multiWorker = new NR.multiWorker({
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
        self.multiWorker.on('start',             function(workerId){                      api.log('worker: started', (self.verbose) ? 'info':'debug', {workerId: workerId}                                                   ); })
        self.multiWorker.on('end',               function(workerId){                      api.log('worker: ended', (self.verbose) ? 'info':'debug',   {workerId: workerId}                                                   ); })
        self.multiWorker.on('cleaning_worker',   function(workerId, worker, pid){         api.log('worker: cleaning old worker ' + worker + '(' + pid + ')', (self.verbose) ? 'info':'debug'                                 ); })
        self.multiWorker.on('poll',              function(workerId, queue){               api.log('worker: polling ' + queue, 'debug',       {workerId: workerId}                                                            ); })
        self.multiWorker.on('job',               function(workerId, queue, job){          api.log('worker: working job ' + queue, 'debug',   {workerId: workerId, job: {class: job.class, queue: job.queue}}                 ); })
        self.multiWorker.on('reEnqueue',         function(workerId, queue, job, plugin){  api.log('worker: reEnqueue job', 'debug',          {workerId: workerId, plugin: plugin, job: {class: job.class, queue: job.queue}} ); })
        self.multiWorker.on('success',           function(workerId, queue, job, result){  api.log('worker: job success ' + queue, 'info',    {workerId: workerId, job: {class: job.class, queue: job.queue}, result: result} ); })
        self.multiWorker.on('pause',             function(workerId){                      api.log('worker: paused', 'debug', {workerId: workerId}                                                                            ); })

        self.multiWorker.on('failure',           function(workerId, queue, job, failure){ api.exceptionHandlers.task(failure, queue, job); })
        self.multiWorker.on('error',             function(workerId, queue, job, error){   api.exceptionHandlers.task(error, queue, job);   })
        
        // multiWorker emitters
        self.multiWorker.on('internalError',     function(error){                         api.log(error, 'error'); })
        self.multiWorker.on('multiWorkerAction', function(verb, delay){                   api.log('*** checked for worker status: ' + verb + ' (event loop delay: ' + delay + 'ms)', 'debug'); })
        
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
        if(api.config.tasks.minTaskProcessors > 0){
          self.multiWorker.stop(function(){
            api.log('task workers stopped');
            callback();
          });
        }else{
          callback();
        }
      }
    }

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
        api.resque.queue.end(function(){
          next();
        });
      });
    });
  },
}
