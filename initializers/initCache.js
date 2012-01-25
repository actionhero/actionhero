////////////////////////////////////////////////////////////////////////////
// cache
// I am an in-memory cache solution

var initCache = function(api, next){
	
	api.cache = {};
	api.cache.data = {};

	api.cache.save = function(api, key, value, expireTimeSeconds, next){
		if(expireTimeSeconds < 0 || expireTimeSeconds == null){ expireTimeSeconds = api.configData.cache.defaultExpireTimeSeconds; }
		var expireTimestamp = new Date().getTime();
		expireTimestamp = expireTimestamp + (expireTimeSeconds * 1000);
		if(api.configData.cache.maxMemoryBytes - process.memoryUsage().heapUsed < 0){
			api.log("Memory @ "+process.memoryUsage().heapUsed+" bytes; not saving another cache object, out of ram (as limtied by api.configData.cache.maxMemoryBytes)", "red")
			next(false);
		}else{
			try{
				api.cache.data[key] = {
					value: value,
					expireTimestamp: expireTimestamp
				};
				process.nextTick(function() { next(true); });
			}catch(e){
				console.log(e);
				process.nextTick(function() { next(false); });
			}
		}
	};

	api.cache.load = function(api, key, next){
		var cacheObj = api.cache.data[key];
		if(cacheObj == null){
			process.nextTick(function() { next(null); });
		}else{
			if(cacheObj.expireTimestamp >= (new Date().getTime())){
				process.nextTick(function() { next(cacheObj.value); });
			}else{
				process.nextTick(function() { next(null); });
			}
		}
	};

	api.cache.destroy = function(api, key, next){
		var cacheObj = api.cache.data[key];
		if(cacheObj == null){
			process.nextTick(function() { next(false); });
		}else{
			delete api.cache.data[key];
			process.nextTick(function() { next(true); });
		}
	};
	
	next();
}

/////////////////////////////////////////////////////////////////////
// exports
exports.initCache = initCache;
