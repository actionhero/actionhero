'use strict';

var REPL = require('repl');

module.exports = function(api, next){

  for(var i in api.config.servers){ api.config.servers[i].enabled = false; }
  api.config.general.developmentMode = false;
  api.config.tasks.scheduler         = false;
  api.config.tasks.queues            = [];
  api.config.tasks.minTaskProcessors = 0;
  api.config.tasks.maxTaskProcessors = 0;

  api.commands.start.call(api._context, function(error){
    if(error){ return next(error); }

    setTimeout(function(){
      var repl = REPL.start({
        prompt:    '[ AH::' + api.env + ' ] >> ',
        input:     process.stdin,
        output:    process.stdout,
        useGlobal: false
      });

      repl.context.api        = api;

      repl.on('exit', function(){
        next(null, true);
      });
    }, 500);
  });
};
