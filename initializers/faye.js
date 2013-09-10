var fayePackage = require('faye');

var faye = function(api, next){
  
  api.faye = {};
  api.faye.extensions = [];
  api.faye.connectHandlers = [];
  api.faye.disconnectHandlers = [];
  // api.faye.subscribeHandlers = [];

  api.faye._start = function(api, next){

    var options = api.configData.faye;
    if(api.redis.fake != true){
      options.engine = {
        type: require('faye-redis'),
        host: api.configData.redis.host,
        port: api.configData.redis.port,
        password: api.configData.redis.password,
        database: api.configData.redis.DB,
        namespace: "faye:",
      }
    }

    api.faye.server = new fayePackage.NodeAdapter(options);
    
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
      next();
    }, 1000);
  }  

  api.faye._teardown = function(api, next){
    api.faye.server.getClient().disconnect();
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
  });

  api.faye.extensions.push({
    incoming: function(message, callback){
      if(message.channel.indexOf('/actionHero') === 0){
        if(message.data.serverToken != api.configData.general.serverToken){
          message.error = "message token miss-match on protected actionHero channel";
          api.log(message.error, "warning", message);
        }
      }
      callback(message);
    }
  });

  next();
}

/////////////////////////////////////////////////////////////////////
// exports
exports.faye = faye;
