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
	api.fs.exists(actionsPath, function (exists) {
	  if(!exists){
	  	var defaultActionsPath = process.cwd() + "/node_modules/actionHero/actions/";
	  	api.log("no ./actions path in project, loading defaults from "+defaultActionsPath, "yellow");
		  actionsPath = defaultActionsPath;
		}

		function loadFolder(path){
			api.fs.readdirSync(path).forEach( function(file) {
				if(path[path.length - 1] != "/"){ path += "/"; } 
				var fullfFilePath = path + file;
				if (file[0] != "."){
					var stats = api.fs.statSync(fullfFilePath);
					if(stats.isDirectory()){
						loadFolder(fullfFilePath);
					}else if(stats.isSymbolicLink()){
						var realPath = readlinkSync(fullfFilePath);
						loadFolder(realPath);
					}else if(stats.isFile()){
						actionLoader(api, fullfFilePath);
					}else{
						api.log(file+" is a type of file I cannot read", "red")
					}
				}
			});
		}

		function actionLoader(api, fullfFilePath, reload){
			if(reload == null){ reload = false; }
			var parts = fullfFilePath.split("/");
			var file = parts[(parts.length - 1)];
			var actionName = file.split(".")[0];
			var loadMessage = "action loaded: " + actionName + ", " + fullfFilePath;
			if(reload){
				loadMessage = "action (re)loaded: " + actionName + ", " + fullfFilePath;
			}else{
				if(api.configData.general.developmentMode == true){
					api.watchedFiles.push(fullfFilePath);
					(function() {
						api.fs.watchFile(fullfFilePath, {interval:1000}, function(curr, prev){
							if(curr.mtime > prev.mtime){
								process.nextTick(function(){
									if(api.fs.readFileSync(fullfFilePath).length > 0){
										delete require.cache[fullfFilePath];
										delete api.actions[actionName];
										actionLoader(api, fullfFilePath, true);
									}
								});
							}
						});
					})();
				}
			}
			try{
				api.actions[actionName] = require(fullfFilePath).action;
				validateAction(api, api.actions[actionName]);
				api.log(loadMessage, "blue");
			}catch(err){
				api.exceptionHandlers.loader(fullfFilePath, err);
			}
		}

		loadFolder(actionsPath);
		
		next();
	});
	
	api.processAction = function(api, connection, messageID, next){	
		if(connection.params.limit == null){ 
			connection.params.limit = api.configData.general.defaultLimit; 
		}else{ 
			connection.params.limit = parseFloat(connection.params.limit); 
		}

		if(connection.params.offset == null){ 
			connection.params.offset = api.configData.general.defaultOffset; 
		}else{ 
			connection.params.offset = parseFloat(connection.params.offset); 
		}
		
		if (connection.error === null){
			if(connection.type == "web"){ api.utils.processRoute(api, connection); }
			connection.action = connection.params["action"];
			if(api.actions[connection.action] != undefined){
				api.utils.requiredParamChecker(api, connection, api.actions[connection.action].inputs.required);
				if(connection.error === null){
					process.nextTick(function() { 
						if(api.domain != null){
							var actionDomain = api.domain.create();
							actionDomain.on("error", function(err){
								api.exceptionHandlers.action(actionDomain, err, connection, next);
							});
							actionDomain.run(function(){
								api.actions[connection.action].run(api, connection, function(connection, toRender){
									connection.respondingTo = messageID;
									// actionDomain.dispose();
									next(connection, toRender);
								}); 
							})
						}else{
							api.actions[connection.action].run(api, connection, function(connection, toRender){
								connection.respondingTo = messageID;
								next(connection, toRender);
							}); 
						}
					});
				}else{
					process.nextTick(function() { 
						connection.respondingTo = messageID;
						next(connection, true);  
					});
				}
			}else{
				if(connection.action == "" || connection.action == null){ connection.action = "{no action}"; }
				connection.error = new Error(connection.action + " is not a known action.");
				process.nextTick(function(){ 
					connection.respondingTo = messageID;
					next(connection, true); 
				});
			}
		}else{
			process.nextTick(function(){ 
				connection.respondingTo = messageID;
				next(connection, true); 
			});
		}
	}
}

/////////////////////////////////////////////////////////////////////
// exports
exports.initActions = initActions;