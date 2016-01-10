exports.enqueueTask = function(binary, next){
  var ActionheroPrototype = require(binary.paths.actionheroRoot + '/actionhero.js').actionheroPrototype;
  var actionhero = new ActionheroPrototype();
  var configChanges = { logger: {transports: null} };

  actionhero.initialize({configChanges: configChanges}, function(err, api){
    try{
      if(!binary.argv.name){ throw new Error('--name required'); }
      if(!api.tasks.tasks[binary.argv.name]){ throw new Error('Task "' + binary.argv.name + '" not found'); }
    }catch(e){
      binary.log(e.message, 'error');
      process.exit(1);
    }

    var args = {};
    if(binary.argv.args){ args = JSON.parse(binary.argv.args); }

    api.resque.startQueue(function(){
      api.tasks.enqueue(binary.argv.name, args, function(error, toRun){
        if(error){
          binary.log(error, 'alert');
          process.exit(1);
        }else{
          binary.log(toRun);
          process.exit();
        }
      });
    });
  });
};
