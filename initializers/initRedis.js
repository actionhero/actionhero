////////////////////////////////////////////////////////////////////////////
// Connnect to Redis and setup channels

/*
Data and what they do:
- actionHero::peers [] a list of all the peers in the action cluster.  New members add themselves to it
- actionHero::tasks [] a list of tasks to be completed.  Any memeber can push to the queue; all workers will pull one at a time from the queue
- actionHero::tasks::{serverID} [] a list of tasks to be completed by only this node.  This queue will be drained at a lower priority than the regular task queue
- actionHero::tasksClaimed [] a list of tasks being either worked on or sleeping by a node.
- actionHero::cache [] the common shared cache object
- actionHero::stats [] the common shared stats object
- actionHero::roomMembers-{roomName} [] a list of the folks in a given socket room

Channels and what they do:
- actionHero::say a channel for saying stuff to everyone
- actionHero::tasks a channel for saying stuff to everyone
*/

var c = {};

var initRedis = function(api, next)
{	
	c = api.configData.redis;
	api.redis = {};
	api.redis.enable = c.enable;
	if(c.enable == true){

		api.redis.channelHandlers = {};
		api.redis.registerChannel = function(api, channel, handler){
			api.redis.clientSubscriber.subscribe(channel);
			api.redis.channelHandlers[channel] = handler;
		}

		api.redis.client = api.redisPackage.createClient(c.port, c.host, c.options);
		api.redis.client.on("error", function (err) {
	        api.log("Redis Error: " + err, ["red", "bold"]);
	        process.exit();  // redis is really important...
	    });

		api.redis.client.on("connect", function (err) {
	        if(c.password != null){ api.redis.client.auth(c.password); }
	        init(api, next);
	    });
	}else{
		api.log("running without redis");
		next();
	}
}

var init = function(api, next){
	// add myself to the list
	api.redis.client.lrem("actionHero::peers", 1, api.id, function(){ // remove me if I already exist
		api.redis.client.rpush("actionHero::peers", api.id, function(){

			// set up say pub/sub listeners
			api.redis.clientSubscriber = api.redisPackage.createClient(c.port, c.host, c.options);
			api.redis.clientSubscriber.on("connect", function (err) {
		        if(c.password != null){ api.redis.client.auth(c.password); }
		       	
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
				api.log("connected to redis @ "+c.host+":"+c.port);
				next();
		    });

		    api.redis.clientSubscriber.on("error", function (err) {
		        api.log("Redis Error: " + err, ["red", "bold"]);
	        	process.exit();  // redis is really important...
		    });
		});
	}); 
}

/////////////////////////////////////////////////////////////////////
// exports
exports.initRedis = initRedis;