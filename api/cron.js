function processCron(api)
{
	api.log("* periodic cron tasks starting now *");

	// run all tasks every time async
	for(var task in api.tasks){
		if (task != "Task"){
			api.tasks[task](api);
		}
	}

	api.log("* periodic cron tasks comple. see you again in " + api.configData.cronTimeInterval + "ms *");
	if(api.cronTimer) { clearTimeout(api.cronTimer); }
	api.cronTimer = setTimeout(api.processCron, api.configData.cronTimeInterval, api);
};

exports.processCron = processCron;