exports.default = { 
  tasks: function(api){
    return {
      // Should this node run a scheduler to promote delayed tasks?
      scheduler: false,
      // what queues should the workers work?
      queues: ['*'],
      // how long to sleep between jobs / scheduler checks
      timeout: 5000,
      // at minimum, how many workers should this node spawn?
      // (have number > 0 to enable, and < 1 to disable)
      minWorkers: 0,
      // at maximum, how many workers should this node spawn?
      maxWorkers: 0,
      // how often should we check the event loop to spawn more workers?
      checkTimeout: 500,
      // how many ms would constitue an event loop delay to hald worker spawning?
      maxEventLoopDelay: 5,
      // What redis server should we connect to for tasks / delayed jobs?
      redis: api.config.redis
    }
  }
}

exports.test = {
  tasks: function(api){
    return {
      scheduler: false,
      timeout: 100,
      queues: ['*'],
      checkTimeout: 50,
      redis: api.config.redis
    }  
  }
}