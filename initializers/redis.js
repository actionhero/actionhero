var uuid = require('node-uuid'),
    events = require('events');

var redis = function(api, next){

  api.redis = {};
  api.redis.clusterCallbaks = {};
  api.redis.clusterCallbakTimeouts = {};
  api.redis.subsciptionHandlers = {};

  if(api.config.redis.database == null){ api.config.redis.database = 0 }

  var redisPackage = require(api.config.redis.package);;
  if(api.config.redis.package === 'fakeredis'){
    api.log('running with fakeredis', 'warning');
    redisPackage.fast = true;
  }

  api.redis._start = function(api, next){
    next();
  }

  api.redis._stop = function(api, next){
    for(var i in api.redis.clusterCallbakTimeouts){
      clearTimeout( api.redis.clusterCallbakTimeouts[i] );
      delete api.redis.clusterCallbakTimeouts[i]
      delete api.redis.clusterCallbaks[i];
    }
    api.redis.doCluster('api.log', ['actionhero member ' + api.id + ' has left the cluster'], null, null);

    process.nextTick(function(){
      api.redis.subscriber.unsubscribe();
      next();
    });
  }

  // connect

  api.redis.initialize = function(callback){
    if(api.config.redis.package === 'fakeredis'){
      api.redis.client     = redisPackage.createClient(String(api.config.redis.host));
      api.redis.subscriber = redisPackage.createClient(String(api.config.redis.host));
    }else{
      api.redis.client     = redisPackage.createClient(api.config.redis.port, api.config.redis.host, api.config.redis.options);
      api.redis.subscriber = redisPackage.createClient(api.config.redis.port, api.config.redis.host, api.config.redis.options);
    }

    api.redis.client.on('error', function(err){
      api.log('Redis Error (client): ' + err, 'emerg');
    });

    api.redis.subscriber.on('error', function(err){
      api.log('Redis Error (subscriber): ' + err, 'emerg');
    });

    api.redis.client.on('connect', function(err){
      if(api.config.redis.database != null){ api.redis.client.select(api.config.redis.database); }
      api.log('connected to redis (client)', 'debug');
    });

    api.redis.subscriber.on('connect', function(err){
      if(api.config.redis.database != null){ api.redis.client.select(api.config.redis.database); }
      api.log('connected to redis (subscriber)', 'debug');
    });

    if(api.config.redis.password != null && api.config.redis.password != ''){
      api.redis.client.auth(api.config.redis.password, function(){
        api.redis.subscriber.auth(api.config.redis.password, function(){
          api.redis.client.select(api.config.redis.database, function(err){
            if(err){ api.log('Error selecting database #' + api.config.redis.database + ' on redis (client)', 'emerg'); }
            api.redis.subscriber.select(api.config.redis.database, function(err){
              if(err){ api.log('Error selecting database #' + api.config.redis.database + ' on redis (subscriber)', 'emerg'); }
              callback();
            });
          });
        });
      });
    } else if(api.config.redis.package === 'fakeredis'){
      process.nextTick(function(){
        api.redis.client.select(api.config.redis.database, function(err){
          if(err){ api.log('Error selecting database #' + api.config.redis.database + ' on redis (client)', 'emerg'); }
          api.redis.subscriber.select(api.config.redis.database, function(err){
            if(err){ api.log('Error selecting database #' + api.config.redis.database + ' on redis (subscriber)', 'emerg'); }
            callback();
          });
        });
      });
    } else {
      process.nextTick(function(){
        var client, subscriber, emitter = new events.EventEmitter();

        api.redis.client.once('connect', function () {
          client = true;
          if (client && subscriber) {
            emitter.emit('go');
          }
        });

        api.redis.subscriber.once('connect', function () {
          subscriber = true;
          if (client && subscriber) {
            emitter.emit('go');
          }
        });

        emitter.once('go', function () {
          if(api.config.redis.database != null){
            api.redis.client.select(api.config.redis.database);
            api.redis.subscriber.select(api.config.redis.database);
          }
          callback();
        });
      });
    }
  };

  // subscribe

  api.redis.subscribe = function(callback){
    var channel = api.config.redis.channel;
    var subscribed = false;

    api.redis.subscriber.on('subscribe', function(messageChannel, count){
      if(subscribed === false){
        subscribed = true;
        callback();
      }
    });

    api.redis.subscriber.on('message', function(messageChannel, message){
      try{ message = JSON.parse(message) }catch(e){ message = {}; }
      if(messageChannel === channel && message.serverToken === api.config.general.serverToken){
        if(api.redis.subsciptionHandlers[message.messageType] != null){
          api.redis.subsciptionHandlers[message.messageType](message);
        }
      }
    });

    api.redis.subscriber.subscribe(channel);
  }

  api.redis.publish = function(payload){
    var channel = api.config.redis.channel;
    api.redis.client.publish(channel, JSON.stringify(payload));
  }

  // Subsciption Handlers

  api.redis.subsciptionHandlers['do'] = function(message){
    if(message.connectionId == null || ( api.connections != null && api.connections.connections[message.connectionId] != null) ){
      var method = eval(message.method); //TODO: Eval makes me sad
      var callback = function(){
        var responseArgs = Array.apply(null, arguments).sort();
        process.nextTick(function(){
          api.redis.respondCluster(message.requestId, responseArgs);
        });
      };
      var args = message.args;
      if(!Array.isArray(args)){ args = [args]; }
      if(args === null){ args = []; }
      args.push(callback);
      method.apply(null, args);
    }
  }

  api.redis.subsciptionHandlers['doResponse'] = function(message){
    if(api.redis.clusterCallbaks[message.requestId] != null){
      clearTimeout(api.redis.clusterCallbakTimeouts[message.requestId]);
      api.redis.clusterCallbaks[message.requestId].apply(null, message.response);
      delete api.redis.clusterCallbaks[message.requestId];
      delete api.redis.clusterCallbakTimeouts[message.requestId];
    }
  }

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
  }

  api.redis.respondCluster = function(requestId, response){
    var payload = {
      messageType  : 'doResponse',
      serverId     : api.id,
      serverToken  : api.config.general.serverToken,
      requestId    : requestId,
      response     : response, // args to pass back, including error
    };

    api.redis.publish(payload);
  }

  // Boot

  api.redis.initialize(function(){
    api.redis.subscribe(function(){
      api.redis.doCluster('api.log', ['actionhero member ' + api.id + ' has joined the cluster'], null, null);
      next();
    });
  });

}

/////////////////////////////////////////////////////////////////////
// exports
exports.redis = redis;
