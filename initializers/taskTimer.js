'use strict';

module.exports = {
  loadPriority:  1000,
  initialize: function(api, next){
    api.taskTimer = {
      middleware: {
        name: 'timer',
        global: false,
        priority: 90,
        preProcessor: function(next){
          var worker = this.worker;
          worker.start = process.hrtime();
          next();
        },
        postProcessor: function(next){
          var worker = this.worker;
          var elapsed = process.hrtime(worker.start);
          var seconds = elapsed[0];
          var millis = elapsed[1] / 1000000;
          api.log('Task ' + worker.job.class + ' finished in ' + seconds + ' s and ' + millis + ' ms.', 'info');
          next();
        }
      }
    };

    api.tasks.addMiddleware(api.taskTimer.middleware, function(error){
      next(error);
    });
  }
};
