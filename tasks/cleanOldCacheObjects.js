var task = {};

/////////////////////////////////////////////////////////////////////
// metadata
task.name = "cleanOldCacheObjects";
task.description = "I will clean out expired cache objects";
task.scope = "all";
task.frequency = 10000;

/////////////////////////////////////////////////////////////////////
// functional
task.run = function(api, params, next){
	var deleted = 0;
	for (var i in api.cache.data){
		var thisEntry = api.cache.data[i];
		if (thisEntry.expireTimestamp < (new Date().getTime())){
			deleted++;
			delete api.cache.data[i];
		}
	}
	// if(deleted > 0){ api.log("Cleared "+deleted+" objects from the cache", "yellow"); }
	
	next(true, null);
};

/////////////////////////////////////////////////////////////////////
// exports
exports.task = task;
