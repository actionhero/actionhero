////////////////////////////////////////////////////////////////////////////
// cache
// I am an in-memory cache solution

var initCache = function(api, next){
	
	api.cache = {};
	api.cache.data = {};
	
	try { api.fs.mkdirSync(api.configData.cache.cacheFolder, "777") } catch(e) {}; 

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
					expireTimestamp: expireTimestamp,
					createdAt: new Date().getTime(),
					readAt: null
				};
				if(typeof next == "function"){ process.nextTick(function() { next(true); }); }
			}catch(e){
				console.log(e);
				if(typeof next == "function"){  process.nextTick(function() { next(false); }); }
			}
		}
	};

	api.cache.load = function(api, key, next){
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
	};

	api.cache.destroy = function(api, key, next){
		var cacheObj = api.cache.data[key];
		if(typeof cacheObj == "undefined"){
			if(typeof next == "function"){  process.nextTick(function() { next(false); }); }
		}else{
			delete api.cache.data[key];
			if(typeof next == "function"){  process.nextTick(function() { next(true); }); }
		}
	};
	
	// check for an existing cache file
	try{
		var fileData = api.fs.readFileSync(api.configData.cache.cacheFolder + api.configData.cache.cacheFile,'utf8');
		api.cache.data = JSON.parse(fileData);
		api.log("data cache from backup file.");
	}catch(e){
		api.log("no cache backup file found, continuing.");
		// api.log(" > "+e);
	}
	
	
	next();
}

/////////////////////////////////////////////////////////////////////
// exports
exports.initCache = initCache;
