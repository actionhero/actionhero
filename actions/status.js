var path = require('path');
var packageJSON = require(path.normalize(__dirname + path.sep + '..' + path.sep  + 'package.json'));

// These values are probably good starting points, but you should expect to tweak them for your application
var maxEventLoopDelay    = process.env.eventLoopDelay || 5;
var maxMemoryAlloted     = process.env.maxMemoryAlloted || 200;
var maxResqueQueueLength = process.env.maxResqueQueueLength || 1000;

exports.status = {
  name: 'status',
  description: 'I will return some basic information about the API',

  outputExample:{
    'id':'192.168.2.11',
    'actionheroVersion':'9.4.1',
    'uptime':10469
  },

  checkRam: function(api, data, callback){
    var consumedMemoryMB = Math.round(process.memoryUsage().heapUsed / 1024 / 1024 * 100) / 100;
    data.response.consumedMemoryMB = consumedMemoryMB;
    if(consumedMemoryMB > maxMemoryAlloted){
      data.response.status = 'Unhealthy';
      data.response.problems.push('Using more than 200MP of RAM/HEAP');
    }

    callback();
  },

  checkEventLoop: function(api, data, callback){
    api.utils.eventLoopDelay(10000, function(error, eventLoopDelay){
      data.response.eventLoopDelay = eventLoopDelay;
      if(eventLoopDelay > maxEventLoopDelay){
        data.response.status = 'Unhealthy';
        data.response.problems.push('EventLoop Blocked for more than 5ms');
      }

      callback();
    });
  },

  checkResqueQueues: function(api, data, callback){
    api.tasks.details(function(error, details){
      if(error){ return callback(error); }
      var length = 0;
      Object.keys(details.queues).forEach(function(q){
        length += details.queues[q].length;
      });

      if(length > maxResqueQueueLength){
        data.response.status = 'Unhealthy';
        data.response.problems.push('Resque Queues filling up');
      }

      callback();
    });
  },

  run: function(api, data, next){
    data.response.status            = 'Healthy';
    data.response.problems          = [];

    data.response.id                = api.id;
    data.response.actionheroVersion = api.actionheroVersion;
    data.response.uptime            = new Date().getTime() - api.bootTime;
    data.response.name              = packageJSON.name;
    data.response.description       = packageJSON.description;
    data.response.version           = packageJSON.version;

    var self = this;
    self.checkRam(api, data, function(error){
      if(error){ return next(error); }
      self.checkEventLoop(api, data, function(error){
        if(error){ return next(error); }
        self.checkResqueQueues(api, data, function(error){
          next(error);
        });
      });
    });
  }
};
