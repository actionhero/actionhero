function describeActions(api, connection, next)
{
	connection.response.actions = [];
	for(var i in api.actionsArray){
		connection.response.actions.push(api.actionsArray[i]);
	}
	if(connection.type == "socket"){
		connection.response.actions.push("quit");
		connection.response.actions.push("paramAdd");
		connection.response.actions.push("paramDelete");
		connection.response.actions.push("paramView");
		connection.response.actions.push("paramsView");
		connection.response.actions.push("paramsDelete");
	}
	connection.response.actions = connection.response.actions.sort();
	next(connection, true);
};

exports.describeActions = describeActions;