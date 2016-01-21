var REPL = require('repl');

module.exports = function(grunt) {
  
  grunt.registerTask('console', 'Get a REPL/console into your application', function(){
    var done = this.async();
    grunt.startActionhero(function(api, actionhero){

      // note this REPL will not run start commands, only the intilizers
      // nor will it run any servers    
            
      for(var i in api.config.servers){
        api.config.servers[i].enabled = false;
      }
      api.config.general.developmentMode = false;
      api.config.tasks.scheduler         = false;
      api.config.tasks.queues            = [];
            
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
            done(); 
          });

        }, 1000); // to leave time for the "cluster member joined" messages
      }); 
      
    }, true);
  });
  
};
