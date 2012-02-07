////////////////////////////////////////////////////////////////////////////
// populate actions

var initActions = function(api, next)
{
	api.actions = {};

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
				api.log("action loaded: " + actionName, "blue");
			}
		});
		next();
	});
	
	api.processAction = function(api, connection, next){
		var templateValidator = require('validator').Validator;
		connection.validator = new templateValidator();
		connection.validator.error = function(msg){ connection.error = msg; };
	
		if(connection.params.limit == null){ connection.params.limit = api.configData.defaultLimit; }
		if(connection.params.offset == null){ connection.params.offset = api.configData.defaultOffset; }
		if(api.configData.logRequests){api.log("action @ " + connection.remoteIP + " | params: " + JSON.stringify(connection.params));}
		
		if (connection.error === false){
			connection.action = connection.params["action"];
			if(api.actions[connection.action] != undefined){
				process.nextTick(function() { api.actions[connection.action].run(api, connection, next); });
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