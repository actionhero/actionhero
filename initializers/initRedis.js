////////////////////////////////////////////////////////////////////////////
// Connnect to Redis and setup channels

/*

actionHero will create the following stores within your redis database:

** Keys **

- `actionHero:peers` [] a list of all the peers in the action cluster.  New members add themselves to it
- `actionHero:peerPings` {} a hash of the last ping time of each peer member.  Useful to check if a peer has gone away
- `actionHero:cache` [] the common shared cache object
- `actionHero:stats` [] the common shared stats object
- `actionHero:roomMembers-{roomName}` [] a list of the folks in a given socket room
- `actionHero:webMessages:{client.id}` [] an array of messages for a http(s) client (expires)
- `actionHero:tasks:global` [] a list of tasks to be completed.  Any memeber can push to the queue; all workers will pull one at a time from the queue
- `actionHero:tasks:delayed` [] a list of tasks to to be completed in the future
- `actionHero:tasks:{serverID}` [] a list of tasks to be completed by only this node.  This queue will be drained at a lower priority than the regular task queue
- `actionHero:tasks:data` {} the data hash for the task queue.
- `actionHero:tasks:processing` [] a list of tasks being worked on.

** Channels **

- `actionHero:say:[db]` the pub/sub channel used for the chat sub-system

*/


var c = {};

var initRedis = function(api, next){  
  c = api.configData.redis;
  api.redis = {};
  api.redis.enable = c.enable;
  if(c.enable == true){

    api.redis.pingTime = 1000;
    api.redis.lostPeerCheckTime = 5000;

    if(c.DB == null){ c.DB = 0; }

    api.redis.channelHandlers = {};

    api.redis.registerChannel = function(api, channel, handler){
      api.redis.clientSubscriber.subscribe(channel);
      api.redis.channelHandlers[channel] = handler;
    }

    api.redis.client = api.redisPackage.createClient(c.port, c.host, c.options);

    if(c.password != null){ 
      api.redis.client.auth(c.password, function(){
        init(api, c, next);
      }); 
    }

    api.redis.client.on("error", function (err) {
        api.log("Redis Error: " + err, ["red", "bold"]);
        process.exit();  // redis is really important...
    });

    api.redis.client.on("connect", function (err) {
        api.log("connected to redis (data)")
    });

    api.redis.client.on("ready", function (err) {
      if(c.password == null){
          init(api, c, next);
        }
    });

  }else{
    api.log("running without redis");
    next();
  }
}

var init = function(api, c, next){
  api.redis.client.select(c.DB, function(err,res){
    if(err){
      api.log("Error selecting DB #"+c.DB+" on redis.  exiting", ["red", "bold"]);
      process.exit();
    }else{
          // add myself to the list
      api.redis.client.lrem("actionHero:peers", 1, api.id, function(){ // remove me if I already exist
        api.redis.client.rpush("actionHero:peers", api.id, function(){

          // set up say pub/sub listeners
          api.redis.clientSubscriber = api.redisPackage.createClient(c.port, c.host, c.options);

          if(c.password != null){ 
            api.redis.clientSubscriber.auth(c.password, function(){
              initPubSub(api, c, next);
            }); 
          }

          api.redis.clientSubscriber.on("error", function (err) {
            api.log("Redis Error: " + err, ["red", "bold"]);
            process.exit();  // redis is really important...
          });

          api.redis.client.on("connect", function (err) {
            api.log("connected to redis (pub-sub)")
          });

          api.redis.clientSubscriber.on("ready", function (err) {
            if(c.password == null){
              initPubSub(api, c, next);
            }
          });

        });
      }); 
    }
  });
}

var initPubSub = function(api, c, next){
  api.redis.clientSubscriber.on("message", function(channel, message){
    try{
      var found = false;
      for(var i in api.redis.channelHandlers){
        if(i === channel){
          found = true;
          api.redis.channelHandlers[i](channel, message);
        }
      }
      if(found == false){
        api.log("message from unknown channel ("+channel+"): "+message, "red");
      }
    }catch(e){
      api.log("redis message processing error: " + e, ["red", "bold"])
    }
  });

  // complete
  api.log("connected to redis @ "+c.host+":"+c.port+" on DB #"+c.DB);
  initPingAndCheck(api, next);
}

var initPingAndCheck = function(api, next){

  api.redis.stopTimers = function(api){
    clearTimeout(api.redis.pingTimer);
    clearTimeout(api.redis.lostPeerTimer);
  }

  api.redis._teardown = function(api, next){
    api.redis.stopTimers(api);
    api.redis.client.lrem("actionHero:peers", 1, api.id, function(err, count){
      if(count != 1){ api.log("Error removing myself from the peers list", "red"); }
      api.redis.client.hdel("actionHero:peerPings", api.id, function(){
        next();
      });
    });
  }

  api.redis.ping = function(api, next){
    clearTimeout(api.redis.pingTimer);
    api.redis.client.hset("actionHero:peerPings", api.id, new Date().getTime(), function(){
      if(api.running){
        api.redis.pingTimer = setTimeout(api.redis.ping, api.redis.pingTime, api);
      }
      if (typeof next == "function"){ next(); }
    });
  }

  api.redis.checkForDroppedPeers = function(api, next){
    clearTimeout(api.redis.lostPeerTimer);
    var allowedOffset = ( api.redis.pingTime * 2 ) + 1;
    api.redis.client.hgetall("actionHero:peerPings", function (err, peerPings){
      api.stats.set(api, "redis:numberOfPeers", api.utils.hashLength(peerPings))
      var peerID = null;
      for(var i in peerPings){
        if( new Date().getTime() - parseInt(peerPings[i]) > allowedOffset){
          peerID = i;
          break; // do one at a time
        }
      }
      if(peerID != null){
        api.log("peer: " + peerID + " has gone away", "red");
        api.redis.client.hdel("actionHero:peerPings", peerID, function(){
          api.redis.client.lrem("actionHero:peers", 1, peerID, function(){
            if(api.running){
              api.redis.lostPeerTimer = setTimeout(api.redis.checkForDroppedPeers, api.redis.lostPeerCheckTime, api);
            }
            if (typeof next == "function"){ next(); }
          });
        });
      }else{
        // api.log("all peers remain connected");
        api.redis.lostPeerTimer = setTimeout(api.redis.checkForDroppedPeers, api.redis.lostPeerCheckTime, api);
        if (typeof next == "function"){ next(); }
      }
    });
  }

  // start timers
  api.redis._start = function(api, next){
    api.redis.ping(api, function(){
      api.redis.checkForDroppedPeers(api, function(){
        next();
      });
    });
  }
  
  next();

}

/////////////////////////////////////////////////////////////////////
// exports
exports.initRedis = initRedis;