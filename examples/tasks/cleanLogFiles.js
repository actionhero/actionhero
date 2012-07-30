var task = {};

/////////////////////////////////////////////////////////////////////
// metadata
task.name = "cleanLogFiles";
task.description = "I will clean (delete) all log files if they get to big";
task.scope = "all";
task.frequency = 60000;

/////////////////////////////////////////////////////////////////////
// functional
task.run = function(api, params, next){
	api.fs.readdirSync(api.configData.logFolder).forEach( function(file) {
		file = api.configData.log.logFolder + "/" + file;
		api.fs.exists(file, function (exists){
			if(exists){
				size = api.fs.statSync(file).size;
				if(size >= api.configData.general.maxLogFileSize)
				{
					api.log(file + " is larger than " + api.configData.general.maxLogFileSize + " bytes.  Deleting.", "yellow");
					api.fs.unlinkSync(file);
				}
			}
		});
	});
	
	next(true, null);
};

/////////////////////////////////////////////////////////////////////
// exports
exports.task = task;
