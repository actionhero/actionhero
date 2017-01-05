'use strict';

const util = require('util');
const winston = require('winston');

module.exports = {
  loadPriority:  100,
  initialize: function(api, next){

    let transports = [];
    let i;
    for(i in api.config.logger.transports){
      let t = api.config.logger.transports[i];
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

      let localizedMessage;
      if(api.config.logger.localizeLogMessages === true){
        localizedMessage = api.i18n.localize(message);
      }else if(typeof message === 'string'){
        localizedMessage = message;
      }else{
        localizedMessage = util.format.apply(this, message);
      }

      if(severity === undefined || severity === null || api.logger.levels[severity] === undefined){ severity = 'info'; }
      let args = [severity, localizedMessage];
      if(data !== null && data !== undefined){ args.push(data); }
      api.logger.log.apply(api.logger, args);
    };

    let logLevels = [];
    for(i in api.logger.levels){ logLevels.push(i); }

    api.log('*** Starting ActionHero ***', 'notice');
    api.log('Logger loaded.  Possible levels include:', 'debug', logLevels);

    next();

  }
};
