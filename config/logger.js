var fs = require('fs');
var cluster = require('cluster');

exports.default = { 
  logger: function(api){
    var logger = { transports: [] };

    // console logger
    if(cluster.isMaster){
      logger.transports.push(function(api, winston){
        return new (winston.transports.Console)({
          colorize: true,
          level: 'info',
          timestamp: true,
        });
      });
    }

    // file logger
    try{
      fs.mkdirSync('./log');
    } catch(e) {
      if(e.code !== 'EEXIST'){
        return next([new Error('Cannot create ./log directory'), e])
      }
    }
    logger.transports.push(function(api, winston) {
      return new (winston.transports.File)({
        filename: api.config.general.paths.log[0] + '/' + api.pids.title + '.log',
        level: 'info',
        timestamp: true
      });
    });

    // the maximum length of param to log (we will truncate)
    logger.maxLogStringLength = 100;

    // you can optionally set custom log levels 
    // logger.levels = {good: 0, bad: 1};

    // you can optionally set custom log colors 
    // logger.colors = {good: 'blue', bad: 'red'};
    
    return logger;
  }
}

exports.test = { 
  logger: function(api){
    return {
      transports: null
    }
  }
}
