////////////////////////////////////////////////////////////////////////////
// postVariable config and load

var initPostVariables = function(api, next)
{
	// special params we will accept
	api.postVariables = [
		"callback",
		"action",
		"limit",
		"offset",
		"sessionKey",
		"id",
		"createdAt",
		"updatedAt"
	];
	for(var i in api.actions){
		var action = api.actions[i];
		if(action.inputs.required.length > 0){
			for(var j in action.inputs.required){
				api.postVariables.push(action.inputs.required[j]);
			}
		}
		if(action.inputs.optional.length > 0){
			for(var j in action.inputs.optional){
				api.postVariables.push(action.inputs.optional[j]);
			}
		}
	}
	for(var model in api.models){
		for(var attr in api.models[model].rawAttributes){
			api.postVariables.push(attr);
		}
	}
	api.postVariables = api.utils.arrayUniqueify(api.postVariables);
	next();
}

/////////////////////////////////////////////////////////////////////
// exports
exports.initPostVariables = initPostVariables;