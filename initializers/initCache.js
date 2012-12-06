////////////////////////////////////////////////////////////////////////////
// cache
// I am an in-memory cache solution

var initCache = function(api, next){

	api.cache = {};
	api.cache.sweeperTimer = null;
	api.cache.sweeperTimeout = 10 * 1000;

	api.cache.stopTimers = function(api){
		clearTimeout(api.cache.sweeperTimer);
	}

	api.cache._teardown = function(api, next){
		api.cache.stopTimers(api);
		next();
	}

	if(api.redis && api.redis.enable === true){
		
		var redisCacheKey = "actionHero:cache";

		api.cache.size = function(api, next){
			api.redis.client.hlen(redisCacheKey, function(err, count){
				next(null, count);
			});
		}

		api.cache.load = function(api, key, next){
			api.redis.client.hget(redisCacheKey, key, function(err, cacheObj){
				if(err != null){ api.log(err, red); }
				try{ var cacheObj = JSON.parse(cacheObj); }catch(e){ }
				if(cacheObj == null){
					if(typeof next == "function"){ 
						process.nextTick(function() { next(new Error("Object not found"), null, null, null, null); });
					}
				}else if( cacheObj.expireTimestamp >= new Date().getTime() || cacheObj.expireTimestamp == null ){
					cacheObj.readAt = new Date().getTime();
					api.redis.client.hset(redisCacheKey, key, JSON.stringify(cacheObj), function(){
						if(typeof next == "function"){  
							process.nextTick(function() { next(null, cacheObj.value, cacheObj.expireTimestamp, cacheObj.createdAt, cacheObj.readAt); });
						}
					});
				}else{
					if(typeof next == "function"){ 
						process.nextTick(function() { next(new Error("Object expired"), null, null, null, null); });
					}
				}
			});
		};

		api.cache.destroy = function(api, key, next){
			api.redis.client.hdel(redisCacheKey, key, function(err, count){
				if(err != null){ api.log(err, red); }
				var resp = true;
				if(count != 1){ resp = false; }
				if(typeof next == "function"){  process.nextTick(function() { next(null, resp); }); }
			});
		};

		api.cache.sweeper = function(api, next){
			api.redis.client.hkeys(redisCacheKey, function(err, keys){
				var started = 0;
				var sweepedKeys = [];
				keys.forEach(function(key){
					started++;
					api.redis.client.hget(redisCacheKey, key, function(err, cacheObj){
						if(err != null){ api.log(err, red); }
						try{ var cacheObj = JSON.parse(cacheObj); }catch(e){ }
						if(cacheObj != null){
							if(cacheObj.expireTimestamp != null && cacheObj.expireTimestamp < new Date().getTime()){
								api.redis.client.hdel(redisCacheKey, key, function(err, count){
									sweepedKeys.push(key);
									started--;
									if(started == 0 && typeof next == "function"){ next(err, sweepedKeys); }
								});
							}else{
								started--;
								if(started == 0 && typeof next == "function"){ next(err, sweepedKeys); }
							}
						}else{
							started--;
							if(started == 0 && typeof next == "function"){ next(err, sweepedKeys); }
						}
					});
				});
				if(keys.length == 0 && typeof next == "function"){ next(err, sweepedKeys); }
			});
		}

	}else{

		api.cache.data = {};

		api.cache.size = function(api, next){
			process.nextTick(function(){
				next(null, api.utils.hashLength(api.cache.data));
			});
		}

		api.cache.load = function(api, key, next){
			var cacheObj = api.cache.data[key];
			if(cacheObj == null){
				process.nextTick(function() { next(new Error("Object not found"), null, null, null, null); });
			}else{
				if(cacheObj.expireTimestamp >= new Date().getTime() || cacheObj.expireTimestamp == null ){
					api.cache.data[key].readAt = new Date().getTime();
					if(typeof next == "function"){  
						process.nextTick(function() { next(null, cacheObj.value, cacheObj.expireTimestamp, cacheObj.createdAt, cacheObj.readAt); });
					}
				}else{
					if(typeof next == "function"){ 
						process.nextTick(function() { next(new Error("Object expired"), null, null, null, null); });
					}
				}
			}
		};

		api.cache.destroy = function(api, key, next){
			var cacheObj = api.cache.data[key];
			if(typeof cacheObj == "undefined"){
				if(typeof next == "function"){  process.nextTick(function() { next(null, false); }); }
			}else{
				delete api.cache.data[key];
				if(typeof next == "function"){  process.nextTick(function() { next(null, true); }); }
			}
		};

		api.cache.sweeper = function(api, next){
			var sweepedKeys = [];
			for (var i in api.cache.data){
				var entry = api.cache.data[i];
				if ( entry.expireTimestamp != null && entry.expireTimestamp < new Date().getTime() ){
					sweepedKeys.push(i);
					delete api.cache.data[i];
				}
			}
			if(typeof next == "function"){ next(null, sweepedKeys); }
		}
	}

	api.cache.save = function(api, key, value, expireTimeMS, next){
		if(typeof expireTimeMS == "function" && typeof next == "undefined"){
			next = expireTimeMS;
			expireTimeMS = null;
		}
		if(expireTimeMS != null){
			var expireTimestamp = new Date().getTime() + expireTimeMS;
		}else{
			expireTimestamp = null;
		}
		var cacheObj = {
			value: value,
			expireTimestamp: expireTimestamp,
			createdAt: new Date().getTime(),
			readAt: null
		}
		if(api.redis && api.redis.enable === true){
			api.redis.client.hset(redisCacheKey, key, JSON.stringify(cacheObj), function(){
				if(typeof next == "function"){ process.nextTick(function() { next(null, true); }); }
			});
		}else{
			try{
				api.cache.data[key] = cacheObj;
				if(typeof next == "function"){ process.nextTick(function() { next(null, true); }); }
			}catch(e){
				api.log("Cache save error: " + e, "red");
				if(typeof next == "function"){  process.nextTick(function() { next(null, false); }); }
			}
		}
	};

	api.cache.runSweeper = function(api){
		clearTimeout(api.cache.sweeperTimer);
		api.cache.sweeper(api, function(err, sweepedKeys){
			if(sweepedKeys.length > 0){
				api.log("cleaned " + sweepedKeys.length + " expired cache keys");
			}
			if(api.running){
				api.cache.sweeperTimer = setTimeout(api.cache.runSweeper, api.cache.sweeperTimeout, api);
			}
		});
	}
	api.cache.runSweeper(api);

	next();
}

/////////////////////////////////////////////////////////////////////
// exports
exports.initCache = initCache;
