function describeActions(api, next)
{
	api.response.actions = api.actionsArray;
	next(true);
};

exports.describeActions = describeActions;