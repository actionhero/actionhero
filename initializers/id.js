var cluster = require('cluster')

var id = function(api, next){

  if(api.configData.general.id == null){
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
