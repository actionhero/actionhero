////////////////////////////////////////////////////////////////////////////
// Connnect to Redis and setup channels

/*
Data and what they do:
- actionHero:peers [] a list of all the peers in the action cluster.  New members add themselves to it
- actionHero:peerPings {} a hash of the last ping time of each peer member.  Useful to check if a peer has gone away
- actionHero:tasks [] a list of tasks to be completed.  Any memeber can push to the queue; all workers will pull one at a time from the queue
- actionHero:tasks::{serverID} [] a list of tasks to be completed by only this node.  This queue will be drained at a lower priority than the regular task queue
- actionHero:tasksClaimed [] a list of tasks being either worked on or sleeping by a node.
- actionHero:cache [] the common shared cache object
- actionHero:stats [] the common shared stats object
- actionHero:roomMembers-{roomName} [] a list of the folks in a given socket room

Channels and what they do:
- actionHero:say a channel for saying stuff to everyone
- actionHero:tasks a channel for saying stuff to everyone
*/

var c = {};

var initRedis = function(api, next)
{	
	c = api.configData.redis;
	api.redis = {};
	api.redis.enable = c.enable;
	if(c.enable == true){

		api.redis.pingTime = 500;
		api.redis.lostPeerCheckTime = 10000;

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

	api.redis.ping = function(api, next){
		clearTimeout(api.redis.pingTimer);
		api.redis.client.hset("actionHero:peerPings", api.id, new Date().getTime(), function(){
			api.redis.pingTimer = setTimeout(api.redis.ping, api.redis.pingTime, api);
			if (typeof next == "function"){ next(); }
		});
	}

	api.redis.checkForDroppedPeers = function(api, next){
		clearTimeout(api.redis.lostPeerTimer);
		var allowedOffset = ( api.redis.pingTime * 2 ) + 1;
		api.redis.client.hgetall("actionHero:peerPings", function (err, peerPings){
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
						api.redis.client.del("actionHero:tasks::"+peerID, function(){
							api.redis.client.hgetall("actionHero:tasksClaimed", function (err, tasksClaimed){
								var tasksCleaned = 0;
								if(tasksClaimed != null && tasksClaimed.length > 0){
									tasksClaimed.map(function(t){
										var task = JSON.parse(t);
										if(task.server == peerID){
											api.redis.client.hdel("actionHero:tasksClaimed", task.taskName, function(){
												api.tasks.enqueue(api, task.taskName, new Date().getTime(), task.params);
												tasksCleaned = tasksCleaned - 1;
												if(tasksCleaned == 0){
													api.tasks.startPeriodicTasks(api, function(){
														api.redis.lostPeerTimer = setTimeout(api.redis.checkForDroppedPeers, api.redis.lostPeerCheckTime, api);
														if (typeof next == "function"){ next(); }
													});
												}
											});
										}
									});
								}else{
									api.tasks.startPeriodicTasks(api, function(){
										api.redis.lostPeerTimer = setTimeout(api.redis.checkForDroppedPeers, api.redis.lostPeerCheckTime, api);
										if (typeof next == "function"){ next(); }
									});
								}
							});
						});
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
	api.redis.ping(api, function(){
		api.redis.checkForDroppedPeers(api, function(){
			next();
		});
	});

}

/////////////////////////////////////////////////////////////////////
// exports
exports.initRedis = initRedis;