function describeActions(api, connection, next)
{
	connection.response.actions = api.actionsArray;
	next(connection, true);
};

exports.describeActions = describeActions;