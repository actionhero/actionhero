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
	api.stats.load(api, function(resp){
		connection.response.stats = resp;
		next(connection, true);
	});
};

/////////////////////////////////////////////////////////////////////
// exports
exports.action = action;