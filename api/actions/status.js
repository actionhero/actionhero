function status(api, connection, next)
{
	connection.response.status = "OK";
	var now = new Date().getTime();
	api.stats.uptime = now - api.stats.startTime;
	
	connection.response.stats = api.stats;
	next(connection, true);
};

exports.status = status;