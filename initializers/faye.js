var fayePackage = require('faye');

var faye = function(api, next){
  
  api.faye = {};
  api.faye.extensions = [];
  api.faye.connectHandlers = [];
  api.faye.disconnectHandlers = [];
  // api.faye.subscribeHandlers = [];

  api.faye._start = function(api, next){
    api.faye.server = new fayePackage.NodeAdapter(api.configData.faye);
    
    api.faye.server.bind('handshake', function(clientId){
      for(var i in api.faye.connectHandlers){
        api.faye.connectHandlers[i](clientId);
      }
    });

    api.faye.server.bind('disconnect', function(clientId){
      for(var i in api.faye.disconnectHandlers){
        api.faye.disconnectHandlers[i](clientId);
      }
    });

    // api.faye.server.bind('subscribe', function(clientId, channel){
    //   api.webSocketServer.handleSubscribe(clientId, channel);
    // });
    
    for(var i in api.faye.extensions){
      api.faye.server.addExtension(api.faye.extensions[i]);
    }

    api.faye.client = api.faye.server.getClient();
    api.faye.client.publish('/_welcome');
    setTimeout(function(){
      api.log("api faye client ID: " + api.faye.client._clientId, 'debug');
    }, 1000);

    next();
  }  

  api.faye.connectHandlers.push(function(clientId){
    api.log("faye client connected: " + clientId, "debug");
  });

  api.faye.disconnectHandlers.push(function(clientId){
    api.log("faye client disconnected: " + clientId, "debug");
  });

  api.faye.extensions.push({
    incoming: function(message, callback){
      if(message.channel.indexOf('/meta/subscribe') === 0){
        if(message.subscription.indexOf("*") >= 0){
          message.error = "actionHero does not allow wildcard subscriptions";
        }
        callback(message);
      }else{
        callback(message);
      }
    }
  })

  next();
}

/////////////////////////////////////////////////////////////////////
// exports
exports.faye = faye;
