'use strict';

const uuid  = require('node-uuid');
const async = require('async');

module.exports = {
  startPriority: 101,
  stopPriority:  999,
  loadPriority:  200,
  initialize: function(api, next){

    api.redis = {};
    api.redis.clients = {};
    api.redis.clusterCallbaks = {};
    api.redis.clusterCallbakTimeouts = {};
    api.redis.subscriptionHandlers = {};
    api.redis.status = {
      subscribed: false,
    };

    api.redis.initialize = function(callback){
      let jobs = [];

      ['client', 'subscriber', 'tasks'].forEach((r) => {
        jobs.push((done) => {
          if(api.config.redis[r].buildNew === true){
            const args = api.config.redis[r].args;
            api.redis.clients[r] = new api.config.redis[r].konstructor(args[0], args[1], args[2]);
            api.redis.clients[r].on('error', (error) => { api.log(['Redis connection `%s` error', r], 'error', error); });
            api.redis.clients[r].on('connect', () => { api.log(['Redis connection `%s` connected', r], 'debug'); });
            api.redis.clients[r].once('connect', done);
          }else{
            api.redis.clients[r] = api.config.redis[r].konstructor.apply(null, api.config.redis[r].args);
            api.redis.clients[r].on('error', (error) => { api.log(['Redis connection `%s` error', r], 'error', error); });
            api.log(['Redis connection `%s` connected', r], 'debug');
            done();
          }
        });
      });

      if(!api.redis.status.subscribed){
        jobs.push((done) => {
          api.redis.clients.subscriber.subscribe(api.config.general.channel);
          api.redis.status.subscribed = true;

          api.redis.clients.subscriber.on('message', (messageChannel, message) => {
            try{ message = JSON.parse(message); }catch(e){ message = {}; }
            if(messageChannel === api.config.general.channel && message.serverToken === api.config.general.serverToken){
              if(api.redis.subscriptionHandlers[message.messageType]){
                api.redis.subscriptionHandlers[message.messageType](message);
              }
            }
          });

          done();
        });
      }

      async.series(jobs, callback);
    };

    api.redis.publish = function(payload){
      const channel = api.config.general.channel;
      api.redis.clients.client.publish(channel, JSON.stringify(payload));
    };

    // Subsciption Handlers

    api.redis.subscriptionHandlers['do'] = function(message){
      if(!message.connectionId || (api.connections && api.connections.connections[message.connectionId])){
        let cmdParts = message.method.split('.');
        let cmd = cmdParts.shift();
        if(cmd !== 'api'){ throw new Error('cannot operate on a method outside of the api object'); }
        let method = api.utils.stringToHash(cmdParts.join('.'));

        function callback(){
          let responseArgs = Array.apply(null, arguments).sort();
          process.nextTick(() => {
            api.redis.respondCluster(message.requestId, responseArgs);
          });
        };

        let args = message.args;
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
      const requestId = uuid.v4();
      const payload = {
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
        api.redis.clusterCallbakTimeouts[requestId] = setTimeout((requestId) => {
          if(typeof api.redis.clusterCallbaks[requestId] === 'function'){
            api.redis.clusterCallbaks[requestId](new Error('RPC Timeout'));
          }
          delete api.redis.clusterCallbaks[requestId];
          delete api.redis.clusterCallbakTimeouts[requestId];
        }, api.config.general.rpcTimeout, requestId);
      }
    };

    api.redis.respondCluster = function(requestId, response){
      const payload = {
        messageType  : 'doResponse',
        serverId     : api.id,
        serverToken  : api.config.general.serverToken,
        requestId    : requestId,
        response     : response, // args to pass back, including error
      };

      api.redis.publish(payload);
    };

    // Boot

    api.redis.initialize(function(error){
      if(error){ return next(error); }
      process.nextTick(next);
    });

  },

  start: function(api, next){
    api.redis.doCluster('api.log', [['actionhero member %s has joined the cluster', api.id]], null, null);
    next();
  },

  stop: function(api, next){
    for(let i in api.redis.clusterCallbakTimeouts){
      clearTimeout(api.redis.clusterCallbakTimeouts[i]);
      delete api.redis.clusterCallbakTimeouts[i];
      delete api.redis.clusterCallbaks[i];
    }
    api.redis.doCluster('api.log', [['actionhero member %s has left the cluster', api.id]], null, null);

    process.nextTick(function(){
      api.redis.clients.subscriber.unsubscribe();
      api.redis.status.subscribed = false;
      next();
    });
  }
};
