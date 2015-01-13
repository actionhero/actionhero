exports.default = { 
  tasks: function(api){
    return {
      // Should this node run a scheduler to promote delayed tasks?
      scheduler: false,
      // what queues should the taskProcessors work?
      queues: ['*'],
      // how long to sleep between jobs / scheduler checks
      timeout: 5000,
      // at minimum, how many parallel taskProcessors should this node spawn?
      // (have number > 0 to enable, and < 1 to disable)
      minTaskProcessors: 0,
      // at maximum, how many parallel taskProcessors should this node spawn?
      maxTaskProcessors: 0,
      // how often should we check the event loop to spawn more taskProcessors?
      checkTimeout: 500,
      // how many ms would constitue an event loop delay to halt taskProcessors spawning?
      maxEventLoopDelay: 5,
      // When we kill off a taskProcessor, should we disonnect that local redis connection?
      toDisconnectProcessors: true,
      // What redis server should we connect to for tasks / delayed jobs?
      redis: api.config.redis
    }
  }
}

exports.test = {
  tasks: function(api){
    return {
      timeout: 100,
      checkTimeout: 50
    }  
  }
}