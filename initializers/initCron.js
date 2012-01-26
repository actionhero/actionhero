////////////////////////////////////////////////////////////////////////////
// Periodic Tasks (fixed timer events)

var initCron = function(api, next)
{
	if (api.configData.cronProcess)
	{
		api.processCron = function(api){
			api.log("* periodic cron tasks starting now *");

			// run all tasks every time async
			var runningTasks = 0;
			for(var task in api.tasks){
				if (task != "Task"){
					runningTasks++;
					api.tasks[task](api, function(){
						runningTasks--;
						if(runningTasks == 0){
							api.log("* periodic cron tasks comple. see you again in " + api.configData.cronTimeInterval + "ms *");
							if(api.cronTimer) { clearTimeout(api.cronTimer); }
							api.cronTimer = setTimeout(api.processCron, api.configData.cronTimeInterval, api);
						}
					});
				}
			}
		};

		api.cronTimer = setTimeout(api.processCron, api.configData.cronTimeInterval, api);
		api.log("periodic (internal cron) interval set to process evey " + api.configData.cronTimeInterval + "ms", "green");
	}
	
	next();
}

/////////////////////////////////////////////////////////////////////
// exports
exports.initCron = initCron;