var action = {};

/////////////////////////////////////////////////////////////////////
// metadata
action.name = "status";
action.description = "I will return some basic information about the API";
action.inputs = {
	"required" : [],
	"optional" : []
};
action.outputExample = {
	status: "OK",
	uptime: 1234,
	stats: {}
}

/////////////////////////////////////////////////////////////////////
// functional
action.run = function(api, connection, next){
	connection.response.status = "OK";
	var now = new Date().getTime();
	api.stats.uptimeSeconds = (now - api.stats.startTime) / 1000;
	api.stats.pid = process.pid;
	connection.response.stats = api.stats;
	next(connection, true);
};

/////////////////////////////////////////////////////////////////////
// exports
exports.action = action;