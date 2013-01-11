var cluster = require('cluster')

var id = function(api, next){

  var externalIP = api.utils.getExternalIPAddress();
  if(externalIP == false){
    api.log(" * Error fetching this host's external IP address; setting id base to 'actionHero'")
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
