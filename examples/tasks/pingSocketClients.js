var task = {};

/////////////////////////////////////////////////////////////////////
// metadata
task.name = "pingSocketClients";
task.description = "I will send a message to all connected socket clients.  This will help with TCP keep-alive and send the current server time";
task.scope = "all";
task.frequency = 60000;

/////////////////////////////////////////////////////////////////////
// functional
task.run = function(api, params, next){
  for(var i in api.socketServer.connections){
    var message = {};
    message.context = "api";
    message.status = "keep-alive";
    message.serverTime = new Date();
    api.socketServer.sendSocketMessage(api.socketServer.connections[i], message);
  }
  // task.log("sent keepAlive to "+api.socketServer.connections.length+" socket clients");
  
  next(true, null);
};

/////////////////////////////////////////////////////////////////////
// exports
exports.task = task;
