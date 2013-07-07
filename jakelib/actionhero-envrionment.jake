var fs = require("fs");
var path = require("path");

namespace("actionHero", function(){

  desc("I will load and init an actionHero envrionment");
  task("envrionment", {async: true}, function() {

    var file_exists = function(file){
      try{
        var stats = fs.lstatSync(file);
        if(stats.isFile() || stats.isSymbolicLink()){
          return true;
        }else{
          return false;
        }
      }catch(e){
        return false;
      }
    }

    if(file_exists(__dirname + "/../actionHero.js")){
      // in the actionHero project itself
      var actionHero_root = __dirname + "/..";
    }else if(file_exists(__dirname + "/../node_modules/actionHero/actionHero.js")){
      // running from a project's node_modules (bin or actionHero)
      var actionHero_root = __dirname + "/../node_modules/actionHero";
    }else{
      // installed globally
      var actionHero_root = path.normalize(__dirname + "/..");
    }

    var actionHeroPrototype = require(actionHero_root + "/actionHero.js").actionHeroPrototype;
    var actionHero = new actionHeroPrototype();

    var configChanges = {
      logger: {
        transports: null,
      }
    }

    actionHero.initialize({configChanges: configChanges}, function(err, api){
      complete(null, api);   
    });
  });

  

});