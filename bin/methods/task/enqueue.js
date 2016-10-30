'use strict';

const optimist = require('optimist');
const argv = optimist
  .demand('name')
  .describe('args', 'JSON-encoded arguments for the task')
  .describe('name', 'The name of the task to run')
  .argv;

module.exports = function(api, next){

  if(!api.tasks.tasks[argv.name]){ throw new Error('Task "' + argv.name + '" not found'); }

  let args = {};
  if(argv.args){ args = JSON.parse(argv.args); }

  api.resque.startQueue(function(){
    api.tasks.enqueue(argv.name, args, function(error, toRun){
      if(error){
        api.log(['%s', error], 'alert');
      }else{
        api.log('response', 'info', toRun);
      }
      next(null, true);
    });
  });
};
