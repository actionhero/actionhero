var tasks = {};

////////////////////////////////////////////////////////////////////////////
// generic task prototype
tasks.Task = { 
	// prototypical params a task should have
	"defaultParams" : {
		"name" : "generic task",
		"desc" : "I do a thing!"
	},
	init: function (api, params, next) {
		this.params = params || this.defaultParams;
		this.api = api;
		if (next != null){this.next = next;}
		this.api.log("  starging task: " + this.params.name, "yellow");
	},
	end: function () {
		this.api.log("  completed task: " + this.params.name, "yellow");
		if (this.next != null){this.next();}
	},		
	run: function() {
		this.api.log("RUNNING: "+this.params.name);
	},
	log: function(message){
		this.api.log(" >> " + this.params.name + " | " + message, "yellow");
	}
};

////////////////////////////////////////////////////////////////////////////
// cleaning old cache entries from ram
tasks.cleanOldCacheObjects = function(api, next) {
	var params = {
		"name" : "Clean cache object",
		"desc" : "I will clean old entires from ram."
	};
	var task = Object.create(api.tasks.Task);
	task.init(api, params, next);
	task.run = function() {
		var deleted = 0;
		for (var i in api.cache.data){
			var thisEntry = api.cache.data[i];
			if (thisEntry.expireTimestamp < (new Date().getTime())){
				deleted++;
				delete api.cache.data[i];
			}
		}
		if(deleted > 0){ task.log("Cleared "+deleted+" objects from the cache"); }
		task.end();
	};
	//
	process.nextTick(function () { task.run() });
};

////////////////////////////////////////////////////////////////////////////
// ensure that log file doesn't get to big
tasks.cleanLogFiles = function(api, next) {
	var params = {
		"name" : "Clean Log Files",
		"desc" : "I will clean (delete) all log files if they get to big."
	};
	var task = Object.create(api.tasks.Task);
	task.init(api, params, next);
	task.run = function() {
		api.fs.readdirSync(api.configData.logFolder).forEach( function(file) {
			file = api.configData.logFolder + "/" + file;
			api.path.exists(file, function (exists){
				if(exists)
				{
					size = api.fs.statSync(file).size;
					if(size >= api.configData.maxLogFileSize)
					{
						task.log(file + " is larger than " + api.configData.maxLogFileSize + " bytes.  Deleting.");
						api.fs.unlinkSync(file);
					}
				}
			});
		});
		task.end();
	};
	//
	process.nextTick(function () { task.run() });
};

////////////////////////////////////////////////////////////////////////////
// server stats
tasks.caclculateStats = function(api, next) {
	var params = {
		"name" : "caclculateStats",
		"desc" : "I will caclculate this (local) server's stats"
	};
	var task = Object.create(api.tasks.Task);
	task.init(api, params, next);
	task.run = function() {
		api.stats.calculate(api, function(){
			task.end();
		}) ;
	};
	//
	process.nextTick(function () { task.run() });
};

////////////////////////////////////////////////////////////////////////////
// perioducally save cache to disc
tasks.saveCacheToDisk = function(api, next) {
	var params = {
		"name" : "saveCacheToDisk",
		"desc" : "I will save the cache object, api.cache.data, to disc every so often"
	};
	var task = Object.create(api.tasks.Task);
	task.init(api, params, next);
	task.run = function() {
		try{
			var fs = api.fs.createWriteStream((api.configData.cache.cacheFolder + api.configData.cache.cacheFile), {flags:"w"})
			var encodedData = new Buffer(JSON.stringify(api.cache.data)).toString('utf8')
			fs.write(encodedData);
			fs.end();
			task.end();
		}catch(e){
			api.log("Error writing to datalogFolder file: " + e, "red");
			task.end();
		}
	};
	//
	process.nextTick(function () { task.run() });
};

////////////////////////////////////////////////////////////////////////////
// Export
exports.tasks = tasks;