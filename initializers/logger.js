var winston = require('winston');

module.exports = {
  loadPriority:  120,
  initialize: function(api, next){

    var transports = [], i;
    for(i in api.config.logger.transports){
      var t = api.config.logger.transports[i];
      if(typeof t === 'function'){
        transports.push(t(api, winston));
      } else {
        transports.push(t);
      }
    }

    api.logger = new (winston.Logger)({
      // TODO We need to manually make these levels until winston switches the order back
      levels: {
        emerg: 8,
        alert: 7,
        crit: 6,
        error: 5,
        warning: 4,
        notice: 3,
        info: 2,
        debug: 1,
        trace: 0
      },
      colors: {
        trace: 'magenta',
        input: 'grey',
        verbose: 'cyan',
        prompt: 'grey',
        debug: 'blue',
        info: 'green',
        data: 'grey',
        help: 'cyan',
        warn: 'yellow',
        error: 'red'
      },
      transports: transports
    });

    if(api.config.logger.levels){
      api.logger.setLevels(winston.config.syslog.levels);
    }

    api.log = function(message, severity){
      if(severity === undefined || severity === null || api.logger.levels[severity] === undefined){ severity = 'info' }
      // if(severity == null || api.logger.levels[severity] == null){ severity = 'info' }
      var args = [ severity, message ];
      args.push.apply(args, Array.prototype.slice.call(arguments, 2));
      api.logger.log.apply(api.logger, args);
    }

    var logLevels = [];
    for(i in api.logger.levels){ logLevels.push(i) }

    api.log('*** starting actionhero ***', 'notice')
    api.log('Logger loaded.  Possible levels include: ', 'trace', logLevels);

    next();

  }
}
