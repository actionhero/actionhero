////////////////////////////////////////////////////////////////////////////
// populate actions

var initActions = function(api, next)
{
	api.actions = {};
	
	var validateAction = function(api, action){
		var fail = function(msg){
			api.log(msg + "; exiting.", ['red', 'bold']);
			process.exit();
		}

		if(typeof action.name != "string" && action.name.length < 1){
			fail("an action is missing `action.name`");
		}else if(typeof action.description != "string" && action.name.description < 1){
			fail("Action "+action.name+" is missing `action.description`");
		}else if(typeof action.inputs != "object"){
			fail("Action "+action.name+" has no inputs");
		}else if(typeof action.inputs.required != "object"){
			fail("Action "+action.name+" has no required inputs");
		}else if(typeof action.inputs.optional != "object"){
			fail("Action "+action.name+" has no optional inputs");
		}else if(typeof action.outputExample != "object"){
			fail("Action "+action.name+" has no outputExample");
		}else if(typeof action.run != "function"){
			fail("Action "+action.name+" has no run method");
		}
	}

	var actionsPath = process.cwd() + "/actions/";
	api.path.exists(actionsPath, function (exists) {
	  if(!exists){
	  	var defaultActionsPath = process.cwd() + "/node_modules/actionHero/actions/";
	  	api.log("no ./actions path in project, loading defaults from "+defaultActionsPath, "yellow");
		  actionsPath = defaultActionsPath;
		}
		api.fs.readdirSync(actionsPath).forEach( function(file) {
			if (file != ".DS_Store"){
				var actionName = file.split(".")[0];
				var thisAction = require(actionsPath + file)["action"];
				api.actions[thisAction.name] = require(actionsPath + file).action;
				validateAction(api, api.actions[thisAction.name]);
				api.log("action loaded: " + actionName, "blue");
			}
		});
		next();
	});
	
	api.processAction = function(api, connection, next){	
		if(connection.params.limit == null){ connection.params.limit = api.configData.defaultLimit; }
		if(connection.params.offset == null){ connection.params.offset = api.configData.defaultOffset; }
		if(api.configData.logRequests){api.log("action @ " + connection.remoteIP + " | params: " + JSON.stringify(connection.params));}
		
		if (connection.error === false){
			connection.action = connection.params["action"];
			if(api.actions[connection.action] != undefined){
				api.utils.requiredParamChecker(api, connection, api.actions[connection.action].inputs.required);
				if(connection.error == false){
					process.nextTick(function() { api.actions[connection.action].run(api, connection, next); });
				}else{
					process.nextTick(function() { next(connection, true);  });
				}
			}else{
				if(connection.action == "" || connection.action == null){connection.action = "{no action}";}
				connection.error = connection.action + " is not a known action.";
				process.nextTick(function() { next(connection, true); });
			}
		}else{
			process.nextTick(function() { next(connection, true); });
		}
	}
}

/////////////////////////////////////////////////////////////////////
// exports
exports.initActions = initActions;