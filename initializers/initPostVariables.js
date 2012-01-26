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
	
	////////////////////////////////////////////////////////////////////////////
	// api param checking
	api.utils.requiredParamChecker = function(api, connection, required_params, mode){
		if(mode == null){mode = "all";}
		if(mode == "all"){
			required_params.forEach(function(param){
				if(connection.error == false && (connection.params[param] === undefined || connection.params[param].length == 0)){
					connection.error = param + " is a required parameter for this action";
				}
			});
		}
		if(mode == "any"){
			var paramString = "";
			var found = false;
			required_params.forEach(function(param){
				if(paramString != ""){paramString = paramString + ",";}
				paramString = paramString + " " + param;
				if(connection.params[param] != null){
					found = true;
				}
			});
			if(found == false)
			{
				connection.error = "none of the required params for this action were provided.  Any of the following are required: " + paramString;
			}
		}
	}
	
	next();
}

/////////////////////////////////////////////////////////////////////
// exports
exports.initPostVariables = initPostVariables;