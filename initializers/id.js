var cluster = require('cluster');
var argv = require('optimist').argv;

var id = function(api, next){

  if(argv["title"] != null){
    api.id = argv["title"];
  }else if(process.env["ACTIONHERO_TITLE"] != null){
    api.id = process.env["ACTIONHERO_TITLE"];
  }else if(api.configData.general.id == null){
    var externalIP = api.utils.getExternalIPAddress();
    if(externalIP == false){
      var message = " * Error fetching this host's external IP address; setting id base to 'actionHero'"
      try{
        api.log(message, "crit");
      }catch(e){
        console.log(message);
      }
      externalIP = 'actionHero';
    }

    api.id = externalIP;
    if(cluster.isWorker){ api.id += ":" + process.pid; }
  }else{
    api.id = api.configData.general.id;
  }
  
  next();
}

/////////////////////////////////////////////////////////////////////
// exports
exports.id = id;
