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
// cleaning old log entries
tasks.cleanOldLogDB = function(api, next) {
	var params = {
		"name" : "Clean Task DB",
		"desc" : "I will remove old entires from the log DB."
	};
	var task = Object.create(api.tasks.Task);
	task.init(api, params, next);
	task.run = function() {
		if(api.models.log != null){
			api.models.log.findAll({where: ["createdAt < (NOW() - INTERVAL 2 HOUR)"]}).on('success', function(old_logs) {
				task.log("deleting "+old_logs.length+" old log DB entries");
				old_logs.forEach(function(log){
					log.destroy();
				});
				task.end();
			});
		}else{
			task.end();
		}
	};
	process.nextTick(function () { task.run() });
};

////////////////////////////////////////////////////////////////////////////
// cleaning old cache entries from DB
tasks.cleanOldCacheDB = function(api, next) {
	var params = {
		"name" : "Clean cache DB",
		"desc" : "I will clean old entires from the cache DB."
	};
	var task = Object.create(api.tasks.Task);
	task.init(api, params, next);
	task.run = function() {
		if(api.models.cache != null){
			api.models.cache.findAll({where: ["expireTime > NOW()"]}).on('success', function(old_caches) {
				task.log("deleting "+old_caches.length+" old cache DB entries");
				old_caches.forEach(function(entry){
					entry.destroy();
				});
				task.end();
			});
		}else{
			task.end();
		}
	};
	//
	process.nextTick(function () { task.run() });
};

////////////////////////////////////////////////////////////////////////////
// cleaning old session entries from DB
tasks.cleanOldSessionDB = function(api, next) {
	var params = {
		"name" : "Clean session DB",
		"desc" : "I will clean old sessions from the session DB."
	};
	var task = Object.create(api.tasks.Task);
	task.init(api, params, next);
	task.run = function() {
		if(api.models.session != null){
			api.models.session.findAll({where: ["updatedAt < DATE_SUB(NOW(), INTERVAL " + api.configData.sessionDurationMinutes + " MINUTE)"]}).on('success', function(old_sessions) {
				task.log("deleting "+old_sessions.length+" old session DB entries");
				old_sessions.forEach(function(entry){
					entry.destroy();
				});
				task.end();
			});
		}else{
			task.end();
		}
	};
	//
	process.nextTick(function () { task.run() });
};

////////////////////////////////////////////////////////////////////////////
// cleaning old cache entries from DB
tasks.pingSocketClients = function(api, next) {
	var params = {
		"name" : "pingSocketClients",
		"desc" : "I will send a message to all connected socket clients.  This will help with TCP keep-alive and send the current server time"
	};
	var task = Object.create(api.tasks.Task);
	task.init(api, params, next);
	task.run = function() {
		for(var i in api.connections){
			var message = {};
			message.context = "api";
			message.status = "keep-alive";
			message.serverTime = new Date();
			api.sendSocketMessage(api.connections[i], message);
		}
		task.log("sent keepAlive to "+api.connections.length+" socket clients");
		task.end();
	};
	//
	process.nextTick(function () { task.run() });
};


////////////////////////////////////////////////////////////////////////////
// Export
exports.tasks = tasks;