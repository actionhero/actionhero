var fayePackage = require('faye');

var faye = function(api, next){
  
  api.faye = {};
  api.faye.extensions = [];

  api.faye._start = function(api, next){
    api.faye.server = new fayePackage.NodeAdapter(api.configData.faye);
    api.faye.server.bind('handshake', function(clientId){
      api.log("faye client connected: " + clientId, "debug");
      // api.webSocketServer.createClient(clientId);
    });
    api.faye.server.bind('disconnect', function(clientId){
      api.log("faye client disconnected: " + clientId, "debug");
      // api.webSocketServer.destroyClient(clientId);
    });
    api.faye.server.bind('subscribe', function(clientId, channel){
      // api.webSocketServer.handleSubscribe(clientId, channel);
    });
    
    for(var i in api.faye.extensions){
      api.faye.server.addExtension(api.faye.extensions[i]);
    }
    api.faye.client = api.faye.server.getClient();
    api.faye.client.publish('/_welcome');
    setTimeout(function(){
      api.log("api faye client ID: " + api.faye.client._clientId, 'debug');
    }, 1000);
  }  

  next();
}

/////////////////////////////////////////////////////////////////////
// exports
exports.faye = faye;
