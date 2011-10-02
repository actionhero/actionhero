function processCron(api)
{
	api.log("* periodic cron tasks starting now *");
	
	//
	
	api.log("* periodic cron tasks comple. see you again in " + api.configData.cronTimeInterval + "ms *");
	if(api.cronTimer) { clearTimeout(api.cronTimer); }
	api.cronTimer = setTimeout(api.processCron, api.configData.cronTimeInterval, api);
};

exports.processCron = processCron;