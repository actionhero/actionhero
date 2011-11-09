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
action.run = function(api, connection, next)
{
	connection.response.status = "OK";
	var now = new Date().getTime();
	api.stats.uptime = now - api.stats.startTime;
	connection.response.stats = api.stats;
	next(connection, true);
};

/////////////////////////////////////////////////////////////////////
// exports
exports.action = action;function status(api, connection, next)
{
	connection.response.status = "OK";
	var now = new Date().getTime();
	api.stats.uptime = now - api.stats.startTime;
	
	connection.response.stats = api.stats;
	next(connection, true);
};

exports.status = status;