'use strict';

var winston = require('winston');

module.exports = {
  loadPriority:  100,
  initialize: function(api, next){

    var transports = [];
    var i;
    for(i in api.config.logger.transports){
      var t = api.config.logger.transports[i];
      if(typeof t === 'function'){
        transports.push(t(api, winston));
      }else{
        transports.push(t);
      }
    }

    api.logger = new (winston.Logger)({transports: transports});

    if(api.config.logger.levels){
      api.logger.setLevels(api.config.logger.levels);
    }else{
      api.logger.setLevels(winston.config.syslog.levels);
    }

    if(api.config.logger.colors){
      winston.addColors(api.config.logger.colors);
    }

    api.log = function(message, severity, data){
      var localizedMessage = api.i18n.localize(message);
      if(severity === undefined || severity === null || api.logger.levels[severity] === undefined){ severity = 'info'; }
      var args = [severity, localizedMessage];
      if(data !== null && data !== undefined){ args.push(data); }
      api.logger.log.apply(api.logger, args);
    };

    var logLevels = [];
    for(i in api.logger.levels){ logLevels.push(i); }

    api.log('*** Starting ActionHero ***', 'notice');
    api.log('Logger loaded.  Possible levels include:', 'debug', logLevels);

    next();

  }
};
