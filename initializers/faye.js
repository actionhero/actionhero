var fayePackage = require('faye');

var faye = function(api, next){

  api.faye = {};
  api.faye.extensions = [];
  api.faye.connectHandlers = [];
  api.faye.disconnectHandlers = [];
  // api.faye.subscribeHandlers = [];

  api.faye._start = function(api, next){

    var options = api.config.faye;
    if(api.config.faye.redis.fake != true){
      options.engine = {
        type:      require('faye-redis'),
        host:      api.config.faye.redis.host,
        port:      api.config.faye.redis.port,
        password:  api.config.faye.redis.password,
        database:  api.config.faye.redis.database,
        namespace: api.config.faye.namespace
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
      api.log('api faye client ID: ' + api.faye.client._clientId, 'debug');
      next();
    }, 1000);
  }

  api.faye._stop = function(api, next){
    api.faye.server.getClient().disconnect();
    next();
  }

  api.faye.redis = function(){
    return api.faye.server._server._engine._engine._redis;
  }

  api.faye.clientExists = function(clientId, callback){
    api.faye.redis().zscore(api.config.faye.namespace + '/clients', function(err, score){
      var found = false;
      if(score != null){ found = true; }
      callback(err, found);
    });
  }

  api.faye.connectHandlers.push(function(clientId){
    api.log('faye client connected: ' + clientId, 'debug');
  });

  api.faye.disconnectHandlers.push(function(clientId){
    api.log('faye client disconnected: ' + clientId, 'debug');
  });

  api.faye.extensions.push({
    incoming: function(message, callback){
      if(message.channel.indexOf('/meta/subscribe') === 0){
        if(message.subscription.indexOf('*') >= 0){
          message.error = 'actionhero does not allow wildcard subscriptions';
          api.log(message.error, 'warning', message);
        }
      }
      callback(message);
    }
  });

  api.faye.extensions.push({
    incoming: function(message, callback){
      if(message.channel.indexOf('/actionhero') === 0){
        if(message.data.serverToken != api.config.general.serverToken){
          message.error = 'message token miss-match on protected actionhero channel';
          api.log(message.error, 'warning', message);
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
