var fs = require('fs');
var winston = require('winston');
var cluster = require('cluster');

var logger = function(api, next){

  var transports = [];
  for(var i in api.configData.logger.transports){
    var t = api.configData.logger.transports[i];
    if(typeof t == "function"){
      transports.push( t(api) );
    }else{
      transports.push(t);
    }
  }

  api.logger = new (winston.Logger)({
    levels: winston.config.syslog.levels,
    transports: transports
  });

  if(api.configData.logger.levels != null){
    api.logger.setLevels(winston.config.syslog.levels);
  }

  api.log = function(message, severity, data){
    if(severity == null){ severity = "info"; }
    if(api.logger.levels[severity] == null){ severity = "info"; }
    api.logger.log(severity, message, data);
  }

  var logLevels = [];
  for(var i in api.logger.levels){
    logLevels.push(i);
  }
  api.log('Logger loaded.  Possible levels include: ', 'debug', logLevels);

  next();

}

/////////////////////////////////////////////////////////////////////
// exports
exports.logger = logger;
