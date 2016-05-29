'use strict';

var uuid = require('node-uuid');

module.exports = {
  startPriority: 101,
  stopPriority:  999,
  loadPriority:  200,
  initialize: function(api, next){

    api.redis = {};
    api.redis.clusterCallbaks = {};
    api.redis.clusterCallbakTimeouts = {};
    api.redis.subscriptionHandlers = {};
    api.redis.status = {
      subscribed: false,
    };

    api.redis.initialize = function(callback){

      if(!api.redis.status.subscribed){
        api.config.redis.subscriber.subscribe(api.config.redis.channel);
        api.redis.status.subscribed = true;

        api.config.redis.subscriber.on('message', function(messageChannel, message){
          try{ message = JSON.parse(message); }catch(e){ message = {}; }
          if(messageChannel === api.config.redis.channel && message.serverToken === api.config.general.serverToken){
            if(api.redis.subscriptionHandlers[message.messageType]){
              api.redis.subscriptionHandlers[message.messageType](message);
            }
          }
        });
      }

      var ready = true;
      ['client', 'subscriber', 'tasks'].forEach(function(r){
        if(
          api.config.redis[r].status && // This check is for fakeredis
          (api.config.redis[r].status !== 'connected' && api.config.redis[r].status !== 'ready')
        ){
          ready = false;
          api.log(['Redis connection `%s` not connected', r], 'warning');
        }else{
          api.log(['Redis connection `%s` connected', r], 'info');
        }
      });

      if(ready === true){
        callback();
      }else{
        setTimeout(api.redis.initialize, 5000, callback);
      }
    };

    api.redis.publish = function(payload){
      var channel = api.config.redis.channel;
      api.config.redis.client.publish(channel, JSON.stringify(payload));
    };

    // Subsciption Handlers

    api.redis.subscriptionHandlers['do'] = function(message){
      if(!message.connectionId || (api.connections && api.connections.connections[message.connectionId])){
        var cmdParts = message.method.split('.');
        var cmd = cmdParts.shift();
        if(cmd !== 'api'){ throw new Error('cannot operate on a method outside of the api object'); }
        var method = api.utils.stringToHash(cmdParts.join('.'));

        var callback = function(){
          var responseArgs = Array.apply(null, arguments).sort();
          process.nextTick(function(){
            api.redis.respondCluster(message.requestId, responseArgs);
          });
        };
        var args = message.args;
        if(args === null){ args = []; }
        if(!Array.isArray(args)){ args = [args]; }
        args.push(callback);
        method.apply(null, args);
      }
    };

    api.redis.subscriptionHandlers.doResponse = function(message){
      if(api.redis.clusterCallbaks[message.requestId]){
        clearTimeout(api.redis.clusterCallbakTimeouts[message.requestId]);
        api.redis.clusterCallbaks[message.requestId].apply(null, message.response);
        delete api.redis.clusterCallbaks[message.requestId];
        delete api.redis.clusterCallbakTimeouts[message.requestId];
      }
    };

    // RPC

    api.redis.doCluster = function(method, args, connectionId, callback){
      var requestId = uuid.v4();
      var payload = {
        messageType  : 'do',
        serverId     : api.id,
        serverToken  : api.config.general.serverToken,
        requestId    : requestId,
        method       : method,
        connectionId : connectionId,
        args         : args,   // [1,2,3]
      };

      api.redis.publish(payload);

      if(typeof callback === 'function'){
        api.redis.clusterCallbaks[requestId] = callback;
        api.redis.clusterCallbakTimeouts[requestId] = setTimeout(function(requestId){
          if(typeof api.redis.clusterCallbaks[requestId] === 'function'){
            api.redis.clusterCallbaks[requestId](new Error('RPC Timeout'));
          }
          delete api.redis.clusterCallbaks[requestId];
          delete api.redis.clusterCallbakTimeouts[requestId];
        }, api.config.redis.rpcTimeout, requestId);
      }
    };

    api.redis.respondCluster = function(requestId, response){
      var payload = {
        messageType  : 'doResponse',
        serverId     : api.id,
        serverToken  : api.config.general.serverToken,
        requestId    : requestId,
        response     : response, // args to pass back, including error
      };

      api.redis.publish(payload);
    };

    // Boot

    api.redis.initialize(function(){
      api.redis.doCluster('api.log', [['actionhero member %s has joined the cluster', api.id]], null, null);
      process.nextTick(next);
    });

  },

  start: function(api, next){
    next();
  },

  stop: function(api, next){
    for(var i in api.redis.clusterCallbakTimeouts){
      clearTimeout(api.redis.clusterCallbakTimeouts[i]);
      delete api.redis.clusterCallbakTimeouts[i];
      delete api.redis.clusterCallbaks[i];
    }
    api.redis.doCluster('api.log', [['actionhero member %s has left the cluster', api.id]], null, null);

    process.nextTick(function(){
      api.config.redis.subscriber.unsubscribe();
      api.redis.status.subscribed = false;
      next();
    });
  }
};
