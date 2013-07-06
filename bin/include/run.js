exports['run'] = function(binary, next){

  if(binary.argv.method == null){ binary.hardError("method is a required input"); }
  if(binary.argv.args != null){
    var args = binary.argv.args.split(",")
  }else{
    var args = [];
  }

  var actionHeroPrototype = require(binary.paths.actionHero_root + "/actionHero.js").actionHeroPrototype;
  var actionHero = new actionHeroPrototype();
  var configChanges = {};
  if(binary.argv.log === true || binary.argv.log == "true"){ 
    // leave as-is
  }else{
    configChanges.logger = {
      levels: winston.config.syslog.levels,
      transports: null,
    }
  }

  actionHero.initialize({configChanges: configChanges}, function(err, api){
    var func = eval(binary.argv.method);
    if(typeof func != 'function'){
      binary.hardError(binary.argv.method + " is not a defined function");
    }else{
      args.push(function(){
        console.log(arguments); 
        process.exit();
      });
      var response = func.apply(null, args);
      if(response !== null && response !== undefined){
        console.log(response);
        process.exit();
      }
    }    
  });
}