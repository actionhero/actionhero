////////////////////////////////////////////////////////////////////////////
// postVariable config and load

var initPostVariables = function(api, next)
{
	// special params we will always accept
	api.postVariables = [
		"callback",
		"action",
		"limit",
		"offset",
		"outputType"
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
	// parse a connections's URL and build params based on RESTful map
	// map is an array of the param's keys in order (ie: /:action/:userID/:email/:gameID => ['userID', 'email', 'gameID'])
	// the action itself will be ommited from consideration in the mapping
	// these are equvilent: [ localhost:8080/a/path/and/stuff?action=randomNumber ] && [ localhost:8080/randomNumber/a/path/and/stuff ]
	api.utils.mapParamsFromURL = function(connection, map, routePrefix){
	  if(connection.parsedURL != null && connection.parsedURL.path != null){
	  	if(map == null){ map = []; };
	    var urlParts = connection.parsedURL.path.split("/");
	    var urlParams = {};
	    var mapCounter = 0;
	    if(connection.params != null){
	    	var actionParam = connection.params.action;
	    }else{
	    	var actionParam = null;
	    }
	    for (var i in urlParts){
	      var part = urlParts[i].split("?")[0];
	      if(part != "" && part != connection.action && part != actionParam && map[mapCounter] != null){
	      	if(routePrefix != null){
	      		if(part != routePrefix){
	      			urlParams[map[mapCounter]] = part;
	      			mapCounter++;
	      		}
	      	}else{
	      		urlParams[map[mapCounter]] = part;
	      		mapCounter++;
	      	}
	      }
	    }
	    return urlParams;
	  }else{
	    return null;
	  }
	}
	
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

	////////////////////////////////////////////////////////////////////////////
	// route processing for web clients
	api.utils.processRoute = function(api, connection){
		if(connection.params["action"] == null || ( api.actions[connection.params["action"]] === undefined && connection.actionSetBy != "queryParam")){
			var method = connection.method.toLowerCase();
			var pathParts = connection.parsedURL.pathname.split("/");
			for(var i in api.routes){
				var routePrefix = i;
				if (pathParts[1] == routePrefix){
					for(var j in api.routes[i]){
						var routeMethod = j;
						var route = api.routes[i][j];
						if(routeMethod == method){
							connection.params["action"] = route.action;
							connection.actionSetBy = "routes";
							var routeParams = api.utils.mapParamsFromURL(connection, route.urlMap, routePrefix);
							for(var k in routeParams){
								if(connection.params[k] == null){
									connection.params[k] = routeParams[k];
								}
							}
							break;
						}
					}
					break;
				}
			}
		}
	}

	// load in the routes file
	var loadRoutes = function(){
		api.routes = {};
		var routesFile = process.cwd() + '/routes.js';
		if(api.fs.existsSync(routesFile)){
			delete require.cache[routesFile];
			api.routes = require(routesFile).routes;
			for(var i in api.routes){
				for(var j in api.routes[i]){
					var tmp = api.routes[i][j];
					delete api.routes[i][j];
					api.routes[i][j.toLowerCase()] = tmp;
				}
			}
			api.log(api.utils.hashLength(api.routes) + " routes loaded from " + routesFile, "green");
		}else{
			api.log("no routes file found, skipping");
		}
	};

	if(api.configData.general.developmentMode == true){
		var routesFile = process.cwd() + '/routes.js';
		api.fs.watchFile(routesFile, {interval:1000}, function(curr, prev){
			if(curr.mtime > prev.mtime){
				process.nextTick(function(){
					if(api.fs.readFileSync(routesFile).length > 0){
						loadRoutes();
					}
				});
			}
		});
	};

	loadRoutes();

	next();
}

/////////////////////////////////////////////////////////////////////
// exports
exports.initPostVariables = initPostVariables;