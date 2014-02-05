var winston = require('winston');

var logger = function(api, next){

  var transports = [], i;
  for(i in api.config.logger.transports){
    var t = api.config.logger.transports[i];
    if(typeof t == 'function'){
      transports.push(t(api, winston));
    } else {
      transports.push(t);
    }
  }

  api.logger = new (winston.Logger)({
    // TODO We need to manually make these levels until winston switches the order back
    levels: {
      emerg: 7,
      alert: 6,
      crit: 5,
      error: 4,
      warning: 3,
      notice: 2,
      info: 1,
      debug: 0
    },
    transports: transports
  });

  if(api.config.logger.levels != null){
    api.logger.setLevels(winston.config.syslog.levels);
  }

  api.log = function(message, severity, data){
    if(severity == null || api.logger.levels[severity] == null){ severity = 'info' }
    if(data != null){
      api.logger.log(severity, message, data);
    } else {
      api.logger.log(severity, message);
    }
  }

  var logLevels = [];
  for(i in api.logger.levels){ logLevels.push(i) }
  api.log('Logger loaded.  Possible levels include: ', 'debug', logLevels);

  next();

}

/////////////////////////////////////////////////////////////////////
// exports
exports.logger = logger;
