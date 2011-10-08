function describeActions(api, next)
{
	api.response.actions = api.actionsArray;
	next();
};

exports.describeActions = describeActions;