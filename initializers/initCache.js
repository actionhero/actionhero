////////////////////////////////////////////////////////////////////////////
// cache
// I am an in-memory cache solution

var initCache = function(api, next){
	
	api.cache = {};
	if(api.redis.enable !== true){
		api.cache.data = {};
	}
	var redisCacheKey = "actionHero::cache";
	var defaultExpireTime = 31622400 // 1 year
	
	api.cache.save = function(api, key, value, expireTimeSeconds, next){
		if(expireTimeSeconds < 0 || expireTimeSeconds == null){ expireTimeSeconds = defaultExpireTime; }
		var expireTimestamp = new Date().getTime();
		expireTimestamp = expireTimestamp + (expireTimeSeconds * 1000);
		var cacheObj = {
						value: value,
						expireTimestamp: expireTimestamp,
						createdAt: new Date().getTime(),
						readAt: null
					}
		if(api.redis.enable === true){
			api.redis.client.hset(redisCacheKey, key, JSON.stringify(cacheObj), function(){
				if(typeof next == "function"){ process.nextTick(function() { next(true); }); }
			});
		}else{
			try{
				api.cache.data[key] = cacheObj;
				if(typeof next == "function"){ process.nextTick(function() { next(true); }); }
			}catch(e){
				console.log(e);
				if(typeof next == "function"){  process.nextTick(function() { next(false); }); }
			}
		}
	};

	api.cache.size = function(api, next){
		if(api.redis.enable === true){
			api.redis.client.hlen(redisCacheKey, function(count){
				next(count);
			});
		}else{
			next(api.utils.hashLength(api.cache.data));
		}
	}

	api.cache.load = function(api, key, next){
		if(api.redis.enable === true){
			api.redis.client.hget(redisCacheKey, key, function (err, cacheObj){
				cacheObj = JSON.parse(cacheObj);
				if(cacheObj.expireTimestamp >= (new Date().getTime())){
					cacheObj.readAt = new Date().getTime();
					api.redis.client.hset(redisCacheKey, key, JSON.stringify(cacheObj), function(){
						if(typeof next == "function"){  
							process.nextTick(function() { next(cacheObj.value, cacheObj.expireTimestamp, cacheObj.createdAt, cacheObj.readAt); });
						}
					});
				}else{
					if(typeof next == "function"){ 
						process.nextTick(function() { next(null, null, null, null); });
					}
				}
			})
		}else{
			var cacheObj = api.cache.data[key];
			if(cacheObj == null){
				process.nextTick(function() { next(null, null, null, null); });
			}else{
				if(cacheObj.expireTimestamp >= (new Date().getTime())){
					api.cache.data[key].readAt = new Date().getTime();
					if(typeof next == "function"){  
						process.nextTick(function() { next(cacheObj.value, cacheObj.expireTimestamp, cacheObj.createdAt, cacheObj.readAt); });
					}
				}else{
					if(typeof next == "function"){ 
						process.nextTick(function() { next(null, null, null, null); });
					}
				}
			}
		}
	};

	api.cache.destroy = function(api, key, next){
		if(api.redis.enable === true){
			api.redis.client.hdel(redisCacheKey, key, function(){
				if(typeof next == "function"){  process.nextTick(function() { next(true); }); }
			});
		}else{
			var cacheObj = api.cache.data[key];
			if(typeof cacheObj == "undefined"){
				if(typeof next == "function"){  process.nextTick(function() { next(false); }); }
			}else{
				delete api.cache.data[key];
				if(typeof next == "function"){  process.nextTick(function() { next(true); }); }
			}
		}
	};
	
	next();
}

/////////////////////////////////////////////////////////////////////
// exports
exports.initCache = initCache;
