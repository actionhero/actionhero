////////////////////////////////////////////////////////////////////////////
// cache
// I am an in-memory cache solution

var initCache = function(api, next){
	
	api.cache = {};
	if(api.redis.enable !== true){
		api.cache.data = {};
	}
	var redisCacheKey = "actionHero:cache";

	api.cache.size = function(api, next){
		if(api.redis.enable === true){
			api.redis.client.hlen(redisCacheKey, function(err, count){
				next(count);
			});
		}else{
			next(api.utils.hashLength(api.cache.data));
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

	api.cache.load = function(api, key, next){
		if(api.redis.enable === true){
			api.redis.client.hget(redisCacheKey, key, function (err, cacheObj){
				cacheObj = JSON.parse(cacheObj);
				if(cacheObj != null && ( cacheObj.expireTimestamp >= new Date().getTime() || cacheObj.expireTimestamp == null )) {
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
				if(cacheObj.expireTimestamp >= new Date().getTime() || cacheObj.expireTimestamp == null ){
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
			api.redis.client.hdel(redisCacheKey, key, function(err, count){
				var resp = true;
				if(count != 1){ resp = false; }
				if(typeof next == "function"){  process.nextTick(function() { next(resp); }); }
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
