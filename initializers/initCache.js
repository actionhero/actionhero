////////////////////////////////////////////////////////////////////////////
// cache
// I am an in-memory cache solution

var initCache = function(api, next){

	api.cache = {};

	if(api.redis && api.redis.enable === true){
		
		var redisCacheKey = "actionHero:cache";

		api.cache.size = function(api, next){
			api.redis.client.hlen(redisCacheKey, function(err, count){
				next(count);
			});
		}

		api.cache.load = function(api, key, next){
			api.redis.client.hget(redisCacheKey, key, function (err, cacheObj){
				if(err != null){ api.log(err, red); }
				cacheObj = JSON.parse(cacheObj);
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

	}else{

		api.cache.data = {};

		api.cache.size = function(api, next){
			next(api.utils.hashLength(api.cache.data));
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
				console.log(e);
				if(typeof next == "function"){  process.nextTick(function() { next(null, false); }); }
			}
		}
	};

	next();

}

/////////////////////////////////////////////////////////////////////
// exports
exports.initCache = initCache;
