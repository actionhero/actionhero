'use strict';

var REPL = require('repl');

exports.console = function(binary, next){
  var actionheroPrototype = require(binary.actionheroRoot + '/actionhero.js').actionheroPrototype;
  var actionhero = new actionheroPrototype();

  var configChanges = {
    general: {developmentMode: false}
  };

  actionhero.initialize({configChanges: configChanges}, function(error, api){
    if(error){ throw(error); }

    for(var i in api.config.servers){ api.config.servers[i].enabled = false; }
    api.config.general.developmentMode = false;
    api.config.tasks.scheduler         = false;
    api.config.tasks.queues            = [];
    api.config.tasks.minTaskProcessors = 0;
    api.config.tasks.maxTaskProcessors = 0;

    actionhero.start(function(){
      setTimeout(function(){
        var repl = REPL.start({
          prompt:    '[ AH::' + api.env + ' ] >> ',
          input:     process.stdin,
          output:    process.stdout,
          useGlobal: false
        });

        repl.context.api        = api;
        repl.context.actionhero = actionhero;

        repl.on('exit', function(){
          next(true);
        });
      }, 1000); // to leave time for the "cluster member joined" messages
    });
  });
};
