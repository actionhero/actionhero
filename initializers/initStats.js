////////////////////////////////////////////////////////////////////////////
// initStats

var initStats = function(api, next){
	api.stats = {};
	// actionHero::stats redis stats object

	if(api.redis.enable !== true){
		api.stats.data = {};
	}

	api.stats.incrament = function(api, key, count, next){
		if(count == null){ count = 1; }
		count = parseFloat(count);
		if(api.redis.enable === true){
			api.redis.client.hincrby("actionHero::stats", key, count, function(){
				if(typeof next == "function"){ process.nextTick(function() { next(true); }); }
			});
		}else{
			if(api.stats.data[key] == null){
				api.stats.data[key] = 0;
			}
			api.stats.data[key] = api.stats.data[key] + count;
			if(typeof next == "function"){ process.nextTick(function() { next(true); }); }
		}
	}

	api.stats.get = function(api, key, next){
		if(api.redis.enable === true){
			api.redis.client.hget("actionHero::stats", key, function (err, cacheObj){
				next(cacheObj);
			});
		}else{
			next(api.stats.data[key]);
		}
	}
	
	api.stats.load = function(api, next){
		var stats = {};
		var now = new Date().getTime();
		stats.id = api.id;
		stats.uptimeSeconds = (now - api.bootTime) / 1000;
		api.cache.size(api, function(numberOfCacheObjects){
			api.stats.get(api, "numberOfSocketRequests", function(numberOfSocketRequests){
				api.stats.get(api, "numberOfWebSocketRequests", function(numberOfWebSocketRequests){
					api.stats.get(api, "numberOfActiveSocketClients", function(numberOfActiveSocketClients){
						api.stats.get(api, "numberOfActiveWebSocketClients", function(numberOfActiveWebSocketClients){
							api.stats.get(api, "numberOfWebRequests", function(numberOfWebRequests){
								api.stats.get(api, "numberOfPeers", function(numberOfPeers){
									api.tasks.queueLength(api, api.tasks.redisQueue, function(queueLength){ // api.tasks.redisQueue will be null if not set

										if(numberOfCacheObjects == null){numberOfCacheObjects = 0;}
										if(numberOfSocketRequests == null){numberOfSocketRequests = 0;}
										if(numberOfWebSocketRequests == null){numberOfWebSocketRequests = 0;}
										if(numberOfActiveSocketClients == null){numberOfActiveSocketClients = 0;}
										if(numberOfActiveWebSocketClients == null){numberOfActiveWebSocketClients = 0;}
										if(numberOfWebRequests == null){numberOfWebRequests = 0;}
										if(numberOfPeers == null){numberOfPeers = 0;}

										numberOfCacheObjects = parseInt(numberOfCacheObjects);
										numberOfSocketRequests = parseInt(numberOfSocketRequests);
										numberOfWebSocketRequests = parseInt(numberOfWebSocketRequests);
										numberOfActiveWebSocketClients = parseInt(numberOfActiveWebSocketClients);
										numberOfActiveSocketClients = parseInt(numberOfActiveSocketClients);
										numberOfWebRequests = parseInt(numberOfWebRequests);
										numberOfPeers = parseInt(numberOfPeers);
										
										stats.memoryConsumption = process.memoryUsage().heapUsed;
										stats.cache = {
											numberOfObjects: numberOfCacheObjects
										};
										if(api.socketServer != null){
											stats.socketServer = {
												numberOfGlobalSocketRequests: numberOfSocketRequests,
												numberOfLocalSocketRequests: api.socketServer.numberOfLocalSocketRequests,
												numberOfLocalActiveSocketClients: api.socketServer.connections.length
											};
										}
										if(api.webSockets != null){
											stats.webSocketServer = {
												numberOfGlobalWebSocketRequests: numberOfWebSocketRequests,
												numberOfLocalActiveWebSocketClients: numberOfActiveWebSocketClients
											};
										}
										if(api.webServer != null){
											stats.webServer = {
												numberOfGlobalWebRequests: numberOfWebRequests,
												numberOfLocalWebRequests: api.webServer.numberOfLocalWebRequests
											};
										}
										sleepingTasks = [];
										for (var i in api.tasks.timers){ sleepingTasks.push(i); }
										stats.queue = {
											queueLength: queueLength,
											sleepingTasks: sleepingTasks
										};

										if(api.redis.enable){
											api.redis.client.llen("actionHero::peers", function(err, length){
												api.redis.client.lrange("actionHero::peers", 0, length, function(err, peers){
													stats.peers = peers;
													if(typeof next == "function"){ next(stats); }
												});
											});
										}else{
											if(typeof next == "function"){ next(stats); }
										}
									});
								});
							});
						});
					});
				});
			});
		});
	}
	
	next();
}

/////////////////////////////////////////////////////////////////////
// exports
exports.initStats = initStats;
