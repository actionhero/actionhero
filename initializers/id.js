var cluster = require('cluster')

var id = function(api, next){

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
  if(api.configData.httpServer.enable){ api.id += ":" + api.configData.httpServer.port }
  if(api.configData.tcpServer.enable){ api.id += ":" + api.configData.tcpServer.port }
  if(cluster.isWorker){ api.id += ":" + process.pid; }
  
  next();
}

/////////////////////////////////////////////////////////////////////
// exports
exports.id = id;
