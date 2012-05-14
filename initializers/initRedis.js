////////////////////////////////////////////////////////////////////////////
// Connnect to Redis and setup channels


/*
Queues and what they do:
- actionHero::peers [] a list of all the peers in the action cluster.  New members add themselves to it
- actionHero::tasks [] a list of tasks to be completed.  Any memeber can push to the queue; all workers will pull one at a time from the queue
- actionHero::cache [] the common shared cache object
- actionHero::stats [] the common shared stats object
*/

var initRedis = function(api, next)
{	
	var c = api.configData.redis;
	api.redis = {};
	api.redis.enable = c.enable;
	if(c.enable == true){
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
			api.log("connected to redis @ "+api.configData.redis.host+":"+api.configData.redis.port);
			next();
		});
	}); 
}

/////////////////////////////////////////////////////////////////////
// exports
exports.initRedis = initRedis;