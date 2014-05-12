var fayePackage = require('faye');
var uuid        = require('node-uuid');

var faye = function(api, next){

  api.faye = {};
  api.faye.extensions = [];
  api.faye.connectHandlers = [];
  api.faye.disconnectHandlers = [];
  api.faye.clusterAskChannel = "/actionhero/cluster/ask";
  api.faye.clusterResponseChannel = "/actionhero/cluster/respond";
  api.faye.clusterTimeout = 1000 * 10;
  api.faye.clusterCallbaks = {};
  api.faye.clusterCallbakTimeouts = {};
  // api.faye.subscribeHandlers = [];

  api.faye._start = function(api, next){

    var options = api.config.faye;
    if(api.config.faye.redis.package != 'fakeredis'){
      // These options are hard-coded within faye-redis
      // Faye-Redis does not support sentinels yet
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

    api.faye.subscription = api.faye.client.subscribe(api.faye.clusterAskChannel, function(message){
      // don't use a domain, as server-server methods should be made very robust independtantly
      // TODO: eval is terrbible 

      if(message.check == null || eval(message.check) != null){ 
        var fn = eval(message.method);
        var callback = function(){
          api.faye.respondCluster(message.requestId, arguments);
        };
        var args = message.args;
        args.push(callback);
        fn.apply(null, args);
      }
    });

    api.faye.subscription = api.faye.client.subscribe(api.faye.clusterResponseChannel, function(message){
      if(api.faye.clusterCallbaks[message.requestId] != null){
        clearTimeout(api.faye.clusterCallbakTimeouts[message.requestId]);
        api.faye.clusterCallbaks[requestId].apply(null, message.response);
        delete api.faye.clusterCallbaks[message.requestId];
        delete api.faye.clusterCallbakTimeouts[message.requestId];
      }
    });

    api.faye.doCluster = function(method, args, check, callback){
      var requestId = uuid.v4();
      var payload = {
        serverId     : api.id,
        serverToken  : api.config.general.serverToken,
        requestId    : requestId,
        check        : check,  // existince check on the reciving servers, like 'api.connections.connections[\'abc123\']' should exist
        method       : method, // api.thing.stuff
        args         : args,   // [1,2,3]
      };

      api.faye.client.publish(api.faye.clusterAskChannel, payload);

      if(typeof callback == 'function'){
        api.faye.clusterCallbaks[requestId] = callback;
        api.faye.clusterCallbakTimeouts = setTimeout(function(requestId){
          api.faye.clusterCallbaks[requestId](new Error('RPC Timeout'));
          delete api.faye.clusterCallbaks[requestId];
          delete api.faye.clusterCallbakTimeouts[requestId];
        }, api.faye.clusterTimeout, requestId);
      }
    }

    api.faye.respondCluster = function(requestId, response){
      var payload = {
        serverId     : api.id,
        serverToken  : api.config.general.serverToken,
        requestId    : requestId,
        response     : response, // args to pass back, including error
      };

      api.faye.client.publish(api.faye.clusterResponseChannel, payload);
    }

    setTimeout(function(){
      api.faye.doCluster('api.log', ['actionhero member ' + api.id + ' has joined the cluster'], null, null);
      next();
    }, 1000);
  }

  api.faye._stop = function(api, next){
    api.faye.doCluster('api.log', ['actionhero member ' + api.id + ' has left the cluster'], null, null);
    api.faye.server.getClient().disconnect();
    next();
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
