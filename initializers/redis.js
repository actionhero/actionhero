var redisPackage = require('redis');

var redis = function(api, next){  

  /* actionHero will create the following stores within your redis database:

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

  api.redis = {};
  api.redis.enable = api.configData.redis.enable;
  if(api.configData.redis.enable == true){

    api.redis.pingTime = 1000;
    api.redis.lostPeerCheckTime = 5000;
    if(api.configData.redis.DB == null){ api.configData.redis.DB = 0; }
    api.redis.channelHandlers = {};
    api.redis.client = redisPackage.createClient(api.configData.redis.port, api.configData.redis.host, api.configData.redis.options);

    if(api.configData.redis.password != null){
      api.redis.client.auth(api.configData.redis.password, function(){
        api.redis.registerServer(next);
      }); 
    }

    api.redis.client.on("error", function (err) {
        api.log("Redis Error: " + err, "emerg");
        process.exit();  // redis is really important...
    });

    api.redis.client.on("connect", function (err) {
        api.log("connected to redis (data)", "debug")
    });

    api.redis.client.on("ready", function (err) {
      if(api.configData.redis.password == null){
          api.redis.registerServer(next);
        }
    });

    api.redis._start = function(api, next){
      api.redis.ping(function(){
        api.redis.checkForDroppedPeers(function(){
          next();
        });
      });
    }

    api.redis._teardown = function(api, next){
      api.redis.stopTimers(api);
      api.redis.client.lrem("actionHero:peers", 1, api.id, function(err, count){
        if(count != 1){ api.log("Error removing myself from the peers list", "error"); }
        api.redis.client.hdel("actionHero:peerPings", api.id, function(){
          next();
        });
      });
    }

    api.redis.stopTimers = function(api){
      clearTimeout(api.redis.pingTimer);
      clearTimeout(api.redis.lostPeerTimer);
    }

    api.redis.registerChannel = function(channel, handler){
      api.redis.clientSubscriber.subscribe(channel);
      api.redis.channelHandlers[channel] = handler;
    }

    api.redis.ping = function(next){
      clearTimeout(api.redis.pingTimer);
      api.redis.client.hset("actionHero:peerPings", api.id, new Date().getTime(), function(){
        if(api.running){
          api.redis.pingTimer = setTimeout(api.redis.ping, api.redis.pingTime, api);
        }
        if (typeof next == "function"){ next(); }
      });
    }

    api.redis.registerServer = function(next){
      api.redis.client.select(api.configData.redis.DB, function(err,res){
        if(err){
          api.log("Error selecting DB #"+api.configData.redis.DB+" on redis.  exiting", "emerg");
          process.exit();
        }else{
          // add myself to the list
          api.redis.client.lrem("actionHero:peers", 1, api.id, function(){ // remove me if I already exist
            api.redis.client.rpush("actionHero:peers", api.id, function(){

              // set up say pub/sub listeners
              api.redis.clientSubscriber = redisPackage.createClient(api.configData.redis.port, api.configData.redis.host, api.configData.redis.options);

              if(api.configData.redis.password != null){ 
                api.redis.clientSubscriber.auth(api.configData.redis.password, function(){
                  api.redis.initPubSub(next);
                }); 
              }

              api.redis.clientSubscriber.on("error", function (err) {
                api.log("Redis Error: " + err, "emerg");
                process.exit();  // redis is really important...
              });

              api.redis.client.on("connect", function (err) {
                api.log("connected to redis (pub-sub)", "debug")
              });

              api.redis.clientSubscriber.on("ready", function (err) {
                if(api.configData.redis.password == null){
                  api.redis.initPubSub(next);
                }
              });

            });
          }); 
        }
      });
    }

    api.redis.checkForDroppedPeers = function(next){
      clearTimeout(api.redis.lostPeerTimer);
      var allowedOffset = ( api.redis.pingTime * 2 ) + 1;
      api.redis.client.hgetall("actionHero:peerPings", function (err, peerPings){
        api.stats.set("redis:numberOfPeers", api.utils.hashLength(peerPings))
        var peerID = null;
        for(var i in peerPings){
          if( new Date().getTime() - parseInt(peerPings[i]) > allowedOffset){
            peerID = i;
            break; // do one at a time
          }
        }
        if(peerID != null){
          api.log("peer: " + peerID + " has gone away", "error");
          api.redis.client.hdel("actionHero:peerPings", peerID, function(){
            api.redis.client.lrem("actionHero:peers", 1, peerID, function(){
              if(api.running){
                api.redis.lostPeerTimer = setTimeout(api.redis.checkForDroppedPeers, api.redis.lostPeerCheckTime, api);
              }
              if (typeof next == "function"){ next(); }
            });
          });
        }else{
          api.redis.lostPeerTimer = setTimeout(api.redis.checkForDroppedPeers, api.redis.lostPeerCheckTime, api);
          if (typeof next == "function"){ next(); }
        }
      });
    }

    api.redis.initPubSub = function(next){
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
            api.log("message from unknown channel ("+channel+"): "+message, "warning");
          }
        }catch(e){
          api.log("redis message processing error: " + e, "error")
        }
      });
      api.log("connected to redis @ "+api.configData.redis.host+":"+api.configData.redis.port+" on DB #"+api.configData.redis.DB, "notice");
      next()
    }
  }else{
    api.log("running without redis", "notice");
    next();
  }
}

/////////////////////////////////////////////////////////////////////
// exports
exports.redis = redis;