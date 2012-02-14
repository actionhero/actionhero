var task = {};

/////////////////////////////////////////////////////////////////////
// metadata
task.name = "saveCacheToDisk";
task.description = "I will periodically save this servers cache to disc";
task.scope = "all";
task.frequency = 60000;

/////////////////////////////////////////////////////////////////////
// functional
task.run = function(api, params, next){
	try{
		var fs = api.fs.createWriteStream((api.configData.cache.cacheFolder + api.configData.cache.cacheFile), {flags:"w"})
		var encodedData = new Buffer(JSON.stringify(api.cache.data)).toString('utf8')
		fs.write(encodedData);
		fs.end();
		next(true, null);
	}catch(e){
		api.log("Error writing to datalogFolder file: " + e, "red");
		next(true, null);
	}
};

/////////////////////////////////////////////////////////////////////
// exports
exports.task = task;
