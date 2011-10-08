var tasks = {};

////////////////////////////////////////////////////////////////////////////
// generic task prototype
tasks.Task = { 
	// prototypical params a task should have
	"defaultParams" : {
		"name" : "generic task",
		"desc" : "I do a thing!"
	},
	init: function (api, params) {
		this.params = params || this.defaultParams;
		this.api = api;
		this.api.log("starging task: " + this.params.name);
	},
	end: function () {
		this.api.log("completed task: " + this.params.name);
	},		
	run: function() {
		//
	}
};

////////////////////////////////////////////////////////////////////////////
// cleaning large log files
tasks.cleanLogFiles = function(api) {
	var params = {
		"name" : "Clean Log Files",
		"desc" : "I will clean (delete) all log files if they get to big."
	};
	var task = Object.create(api.tasks.Task);
	task.init(api, params);
	task.run = function() {
		var logs = [
			(api.configData.logFolder + "/" + api.configData.logFile)
		];

		logs.forEach(function(log){
			api.path.exists(log, function (exists){
				if(exists)
				{
					size = api.fs.statSync(log).size;
					if(size >= api.configData.maxLogFileSize)
					{
						api.log(log + " is larger than " + api.configData.maxLogFileSize + " bytes.  Deleting.")
						api.fs.unlinkSync(log);
					}
				}
			});
		});
	};
	task.run();
	task.end();
};

////////////////////////////////////////////////////////////////////////////
// cleaning old log entries
tasks.cleanTaskDB = function(api) {
	var params = {
		"name" : "Clean Task DB",
		"desc" : "I will remove old entires from the log DB."
	};
	var task = Object.create(api.tasks.Task);
	task.init(api, params);
	task.run = function() {
		api.models.log.findAll({where: ["createdAt < (NOW() - INTERVAL 2 HOUR)"]}).on('success', function(old_logs) {
			old_logs.forEach(function(log){
				log.destroy();
			});
		});
	};
	task.run();
	task.end();
};

////////////////////////////////////////////////////////////////////////////
// cleaning old cache entries from DB
tasks.cleanOldCacheDB = function(api) {
	var params = {
		"name" : "Clean cache DB",
		"desc" : "I will clean old entires from the cache DB."
	};
	var task = Object.create(api.tasks.Task);
	task.init(api, params);
	task.run = function() {
		api.models.cache.findAll({where: ["expireTime > NOW()"]}).on('success', function(old_caches) {
			old_caches.forEach(function(entry){
				entry.destroy();
			});
		});
	};
	task.run();
	task.end();
};

////////////////////////////////////////////////////////////////////////////
// cleaning old session entries from DB
tasks.cleanOldSessionDB = function(api) {
	var params = {
		"name" : "Clean session DB",
		"desc" : "I will clean old sessions from the session DB."
	};
	var task = Object.create(api.tasks.Task);
	task.init(api, params);
	task.run = function() {
		api.models.session.findAll({where: ["updatedAt < (NOW() - INTERVAL 1 DAY)"]}).on('success', function(old_caches) {
			old_caches.forEach(function(entry){
				entry.destroy();
			});
		});
	};
	task.run();
	task.end();
};

////////////////////////////////////////////////////////////////////////////
// Export
exports.tasks = tasks;