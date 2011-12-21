////////////////////////////////////////////////////////////////////////////
// actionHero Framweork in node.js
// evantahler@gmail.com
// https://github.com/evantahler/actionHero

var actionHero = {};

////////////////////////////////////////////////////////////////////////////
// Init
actionHero.initRequires = function(api, next)
{
	api.utils = require(__dirname + '/utils.js').utils;
	api.cache = require(__dirname + '/cache.js').cache;

	if (api.cluster.isMaster) { 
		var taskFile = process.cwd() + "/tasks.js";
		api.path.exists(taskFile, function (exists) {
		  if(!exists){
		  	taskFile = __dirname + "/tasks.js";
		  	api.log("no ./tasks.js file in project, loading defaults tasks from  "+taskFile, "yellow");
		  }
		  api.tasks = require(taskFile).tasks;
		  next();	
		});
	}else{
		next();	
	}
}

////////////////////////////////////////////////////////////////////////////
// Init logging folder
actionHero.initLogFolder = function(api, next)
{
	try { api.fs.mkdirSync(api.configData.logFolder, "777") } catch(e) {}; 
	next();
}

////////////////////////////////////////////////////////////////////////////
// DB setup
actionHero.initDB = function(api, next)
{
	if(api.configData.database != null){
		
		var rawDBParams = {
		  user: api.configData.database.username,
		  password: api.configData.database.password,
		  port: api.configData.database.port,
		  host: api.configData.database.host
		};
		api.rawDBConnction = api.mysql.createClient(rawDBParams);
		api.rawDBConnction.query('USE '+api.configData.database.database, function(e){
			if(e){
				console.log(" >> error connecting to database, exiting");
				console.log(JSON.stringify({database: rawDBParams.database, user: rawDBParams.user, host: rawDBParams.host, port: rawDBParams.port, password: "[censored]"}));
				process.exit();	
			}else{
				api.dbObj = new api.SequelizeBase(api.configData.database.database, api.configData.database.username, api.configData.database.password, {
					host: api.configData.database.host,
					port: api.configData.database.port,
					logging: api.configData.database.consoleLogging
				});

				api.models = {};
				api.seeds = {};
				api.modelsArray = [];

				var modelsPath = process.cwd() + "/models/";
				api.path.exists(modelsPath, function (exists) {
				  if(!exists){
				  	var defaultModelsPath = __dirname + "/models/";
				  	if (api.cluster.isMaster) { api.log("no ./modles path in project, loading defaults from "+defaultModelsPath, "yellow"); }
					  modelsPath = defaultModelsPath;
					}

					api.fs.readdirSync(modelsPath).forEach( function(file) {
						var modelName = file.split(".")[0];
						api.models[modelName] = require(modelsPath + file)['defineModel'](api);
						api.seeds[modelName] = require(modelsPath + file)['defineSeeds'](api);
						api.modelsArray.push(modelName); 
						if (api.cluster.isMaster) { api.log("model loaded: " + modelName, "blue"); }
					});
					api.dbObj.sync().on('success', function() {
						for(var i in api.seeds)
						{
							var seeds = api.seeds[i];
							var model = api.models[i];
							if (seeds != null)
							{
								api.utils.DBSeed(api, model, seeds, function(seeded, modelResp){
									if (api.cluster.isMaster) { if(seeded){ api.log("Seeded data for: "+modelResp.name, "cyan"); } }
								});
							}
						}
						if (api.cluster.isMaster) { api.log("DB conneciton sucessfull and Objects mapped to DB tables", "green"); }
						next();
					}).on('failure', function(error) {
						api.log("trouble synchronizing models and DB.  Correct DB credentials?", "red");
						api.log(JSON.stringify(error));
						api.log("exiting", "red");
						process.exit();
					})
				});
			}
		});
	}else{
		next();
	}
}

////////////////////////////////////////////////////////////////////////////
// postVariable config and load
actionHero.initPostVariables = function(api, next)
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

////////////////////////////////////////////////////////////////////////////
// populate actions
actionHero.initActions = function(api, next)
{
	api.actions = {};

	var actionsPath = process.cwd() + "/actions/";
	api.path.exists(actionsPath, function (exists) {
	  if(!exists){
	  	var defaultActionsPath = __dirname + "/actions/";
	  	if (api.cluster.isMaster) { api.log("no ./actions path in project, loading defaults from "+defaultActionsPath, "yellow"); }
		  actionsPath = defaultActionsPath;
		}
		api.fs.readdirSync(actionsPath).forEach( function(file) {
			if (file != ".DS_Store"){
				var actionName = file.split(".")[0];
				var thisAction = require(actionsPath + file)["action"];
				api.actions[thisAction.name] = require(actionsPath + file).action;
				if (api.cluster.isMaster) { api.log("action loaded: " + actionName, "blue"); }
			}
		});
		next();
	});
}

////////////////////////////////////////////////////////////////////////////
// Periodic Tasks (fixed timer events)
actionHero.initCron = function(api, next)
{
	if (api.configData.cronProcess)
	{
		api.processCron = require(__dirname + "/cron.js").processCron;
		api.cronTimer = setTimeout(api.processCron, api.configData.cronTimeInterval, api);
		api.log("periodic (internal cron) interval set to process evey " + api.configData.cronTimeInterval + "ms", "green");
	}
	next();
}


////////////////////////////////////////////////////////////////////////////
// Generic Action processing
actionHero.processAction = function(api, connection, next)
{
	var templateValidator = require('validator').Validator;
	connection.validator = new templateValidator();
	connection.validator.error = function(msg){ connection.error = msg; };
	
	if(api.models != null && api.models.log != null){
		api.models.log.count({where: ["ip = ? AND createdAt > (NOW() - INTERVAL 1 HOUR)", connection.remoteIP]}).on('success', function(requestThisHourSoFar) {
			connection.requestCounter = requestThisHourSoFar + 1;
			if(connection.params.limit == null){ connection.params.limit = api.configData.defaultLimit; }
			if(connection.params.offset == null){ connection.params.offset = api.configData.defaultOffset; }
			if(api.configData.logRequests){api.log("action @ " + connection.remoteIP + " | params: " + JSON.stringify(connection.params));}
			if(connection.requestCounter <= api.configData.apiRequestLimit || api.configData.logRequests == false)
			{
				connection.action = connection.params["action"];
				if(api.actions[connection.action] != undefined){
					process.nextTick(function() { api.actions[connection.action].run(api, connection, next); });
				}else{
					if(connection.action == ""){connection.action = "{no action}";}
					connection.error = connection.action + " is not a known action.";
					process.nextTick(function() { next(connection, true); });
				}
			}else{
				connection.requestCounter = api.configData.apiRequestLimit;
				connection.error = "You have exceded the limit of " + api.configData.apiRequestLimit + " requests this hour.";
				process.nextTick(function() { next(connection, true); });
			}
		});
	}else{
		if(connection.params.limit == null){ connection.params.limit = api.configData.defaultLimit; }
		if(connection.params.offset == null){ connection.params.offset = api.configData.defaultOffset; }
		if(api.configData.logRequests){api.log("action @ " + connection.remoteIP + " | params: " + JSON.stringify(connection.params));}
		connection.action = connection.params["action"];
		if(api.actions[connection.action] != undefined){
			process.nextTick(function() { api.actions[connection.action].run(api, connection, next); });
		}else{
			if(connection.action == ""){connection.action = "{no action}";}
			connection.error = connection.action + " is not a known action.";
			process.nextTick(function() { next(connection, true); });
		}
	}
}

actionHero.logAction = function(api, connection){
	if(api.models != null && api.models.log != null){
		var logRecord = api.models.log.build({
			ip: connection.remoteIP,
			action: connection.action,
			error: connection.error,
			params: JSON.stringify(connection.params)
		});
		process.nextTick(function() { logRecord.save(); });
	}
}

////////////////////////////////////////////////////////////////////////////
// Web Request Processing
actionHero.initWebListen = function(api, next)
{
	api.webApp.listen(api.configData.webServerPort);
	api.webApp.use(api.expressServer.bodyParser());
	api.webApp.all('/*', function(req, res, next){
		api.stats.numberOfWebRequests = api.stats.numberOfWebRequests + 1;
		
		var connection = {};
		
		connection.type = "web";
		connection.timer = {};
		connection.timer.startTime = new Date().getTime();
		connection.req = req;
		connection.res = res;
		connection.response = {}; // the data returned from the API
		connection.error = false; 	// errors and requst state
		connection.remoteIP = connection.req.connection.remoteAddress;
		connection.contentType = "application/json";
		connection.res.header("X-Powered-By",api.configData.serverName);
		if(connection.req.headers['x-forwarded-for'] != null)
		{
			connection.remoteIP = connection.req.headers['x-forwarded-for'];	
		}
		
		connection.params = {};
		api.postVariables.forEach(function(postVar){
			connection.params[postVar] = connection.req.param(postVar);
			if (connection.params[postVar] === undefined){ connection.params[postVar] = connection.req.cookies[postVar]; }
		});
		
		if(connection.params["action"] == undefined){
			connection.params["action"] = connection.req.params[0].split("/")[0];
		}
		if(connection.req.form){
			if (connection.req.body == null || api.utils.hashLength(connection.req.body) == 0){
				connection.req.form.complete(function(err, fields, files){
					api.postVariables.forEach(function(postVar){
						if(fields[postVar] != null && fields[postVar].length > 0){ connection.params[postVar] = fields[postVar]; }
					});
					connection.req.files = files;
					process.nextTick(function() { actionHero.processAction(api, connection, api.respondToWebClient); });
				});
			}else{
					api.postVariables.forEach(function(postVar){ 
					if(connection.req.body[postVar] != null && connection.req.body[postVar].length > 0){ connection.params[postVar] = connection.req.body[postVar]; }
				});
				process.nextTick(function() { actionHero.processAction(api, connection, api.respondToWebClient); });
			}
		}else{
			process.nextTick(function() { actionHero.processAction(api, connection, api.respondToWebClient); });
		}
	});
	
	api.respondToWebClient = function(connection, cont){
		if(cont != false)
		{
			var response = api.buildWebResponse(connection);
	  		try{
	  			connection.res.header('Content-Type', connection.contentType);
				process.nextTick(function() { connection.res.send(response); });
			}catch(e)
			{
				
			}
			// if(api.configData.logRequests){api.log(" > web request from " + connection.remoteIP + " | response: " + JSON.stringify(response), "grey");}
			if(api.configData.logRequests){api.log(" > web request from " + connection.remoteIP + " | responded in : " + connection.response.serverInformation.requestDuration + "ms", "grey");}
		}
		process.nextTick(function() { actionHero.logAction(api, connection); });
	};
	
	api.buildWebResponse = function(connection)
	{	
		connection.response = connection.response || {};
			
		// serverInformation information
		connection.response.serverInformation = {};
		connection.response.serverInformation.serverName = this.configData.serverName;
		connection.response.serverInformation.apiVerson = this.configData.apiVerson;
		
		// requestorInformation
		connection.response.requestorInformation = {};
		connection.response.requestorInformation.remoteAddress = connection.remoteIP;
		connection.response.requestorInformation.RequestsRemaining = this.configData.apiRequestLimit - connection.requestCounter;
		connection.response.requestorInformation.recievedParams = {};
		for(var k in connection.params){
			if(connection.params[k] != undefined){
				connection.response.requestorInformation.recievedParams[k] = connection.params[k] ;
			}
		};
		
		// request timer
		connection.timer.stopTime = new Date().getTime();
		connection.response.serverInformation.requestDuration = connection.timer.stopTime - connection.timer.startTime;
			
		// errors
		if(connection.error == false){
			connection.response.error = "OK";
		}
		else{
			connection.response.error = connection.error;
		}
			
		if(connection.params.callback != null){
			connection.contentType = "application/javascript";
			return connection.params.callback + "(" + JSON.stringify(connection.response) + ");";
		}
		
		return JSON.stringify(connection.response);
	};
	
	next();
}

////////////////////////////////////////////////////////////////////////////
// Socket Request Processing
actionHero.initSocketServerListen = function(api, next){
	api.gameListeners = {}

	api.socketServer = api.net.createServer(function (connection) {
		api.stats.numberOfSocketRequests = api.stats.numberOfSocketRequests + 1;
	  	connection.setEncoding("utf8");
	  	connection.type = "socket";
		connection.params = {};
		connection.remoteIP = connection.remoteAddress;
		connection.id = connection.remoteAddress + "@" + connection.remotePort;
	
	  	connection.on("connect", function () {
	    	api.sendSocketMessage(connection, {welcome: api.configData.socketServerWelcomeMessage});
	    	api.log("socket connection "+connection.remoteIP+" | connected");
	  	});
	  	connection.on("data", function (data) {
			var data = data.replace(/(\r\n|\n|\r)/gm,"");
			var words = data.split(" ");
	    	if(words[0] == "quit" || words[0] == "exit" || words[0] == "close" || data.indexOf("\u0004") > -1 ){
				api.sendSocketMessage(connection, {status: "Bye!"});
				connection.end();
				api.log("socket connection "+connection.remoteIP+" | requesting disconnect");
			}else if(words[0] == "paramAdd"){
				var parts = words[1].split("=");
				connection.params[parts[0]] = parts[1];
				api.sendSocketMessage(connection, {status: "OK"});
				api.log("socket connection "+connection.remoteIP+" | "+data);
			}else if(words[0] == "paramDelete"){
				connection.data.params[words[1]] = null;
				api.sendSocketMessage(connection, {status: "OK"});
				api.log("socket connection "+connection.remoteIP+" | "+data);
			}else if(words[0] == "paramView"){
				var q = words[1];
				api.sendSocketMessage(connection, {q: connection.params[q]});
				api.log("socket connection "+connection.remoteIP+" | "+data);
			}else if(words[0] == "paramsView"){
				api.sendSocketMessage(connection, connection.params);
				api.log("socket connection "+connection.remoteIP+" | "+data);
			}else if(words[0] == "paramsDelete"){
				connection.params = {};
				api.sendSocketMessage(connection, {status: "OK"});
				api.log("socket connection "+connection.remoteIP+" | "+data);
			}else{
				connection.error = false;
				connection.response = {};
				// if(connection.params["action"] == null || words.length == 1){connection.params["action"] = words[0];}
				connection.params["action"] = words[0];
				process.nextTick(function() { actionHero.processAction(api, connection, api.respondToSocketClient); });
				api.log("socket connection "+connection.remoteIP+" | "+data);
			}
	  	});
	  	connection.on("end", function () {
	    	connection.end();
			api.log("socket connection "+connection.remoteIP+" | disconnected");
	  	});
	});
	
	// action response helper
	api.respondToSocketClient = function(connection, cont){
		if(cont != false)
		{
			if(connection.error == false){
				if(connection.response == {}){
					connection.response = {status: "OK"};
				}
				api.sendSocketMessage(connection, connection.response);
			}else{
				api.sendSocketMessage(connection, {error: connection.error});
			}
		}
		process.nextTick(function() { actionHero.logAction(api, connection); });
	}
	
	//message helper
	api.sendSocketMessage = function(connection, message){
		process.nextTick(function() { 
			try{ connection.write(JSON.stringify(message) + "\r\n\0"); }catch(e){ }
		});
	}
	
	// listen
	api.socketServer.listen(api.configData.socketServerPort);
	
	next();
}

////////////////////////////////////////////////////////////////////////////
// logging
actionHero.log = function(original_message, styles){	
	if(this.configData != null && this.configData.logging == true)
	{
		// styles is an array of styles
		if (styles == null){styles = ["white"];}

		if(this.utils != undefined){
			var time_string = this.utils.sqlDateTime();
		}else{
			var time_string = "!";
		}

		var console_message = this.consoleColors.grey(time_string) + this.consoleColors.grey(" | ");
		var inner_message = original_message;
		for(var i in styles){
			var style = styles[i];
			if(style == "bold"){inner_message = this.consoleColors.bold(inner_message);}
			else if(style == "italic"){inner_message = this.consoleColors.italic(inner_message);}
			else if(style == "underline"){inner_message = this.consoleColors.underline(inner_message);}
			else if(style == "inverse"){inner_message = this.consoleColors.inverse(inner_message);}
			else if(style == "white"){inner_message = this.consoleColors.white(inner_message);}
			else if(style == "grey"){inner_message = this.consoleColors.grey(inner_message);}
			else if(style == "black"){inner_message = this.consoleColors.black(inner_message);}
			else if(style == "blue"){inner_message = this.consoleColors.blue(inner_message);}
			else if(style == "cyan"){inner_message = this.consoleColors.cyan(inner_message);}
			else if(style == "green"){inner_message = this.consoleColors.green(inner_message);}
			else if(style == "yellow"){inner_message = this.consoleColors.yellow(inner_message);}
			else if(style == "red"){inner_message = this.consoleColors.red(inner_message);}
			else if(style == "cyan"){inner_message = this.consoleColors.cyan(inner_message);}
			else if(style == "magenta"){inner_message = this.consoleColors.magenta(inner_message);}
			else if(style == "rainbow"){inner_message = this.consoleColors.rainbow(inner_message);}
			else if(style == "black"){inner_message = this.consoleColors.black(inner_message);}
			else if(style == "zebra"){inner_message = this.consoleColors.zebra(inner_message);}
			else if(style == "zalgo"){inner_message = this.consoleColors.zalgo(inner_message);}
		}
		console_message += inner_message;
		console.log(console_message);
		var file_message = time_string + " | " + original_message;
		if (this.logWriter == null){
			this.logWriter = this.fs.createWriteStream((this.configData.logFolder + "/" + this.configData.logFile), {flags:"a"});
		}
		try{
			this.logWriter.write(file_message + "\r\n");
		}catch(e){
			console.log(" !!! Error writing to log file: " + e);
		}
	}
};
 
////////////////////////////////////////////////////////////////////////////
// final flag
actionHero.initMasterComplete = function(api, next){
	api.log("");
	api.log("*** Master Started @ " + api.utils.sqlDateTime() + " @ web port " + api.configData.webServerPort + " & socket port " + api.configData.socketServerPort + " ***", ["green", "bold"]);
	api.log("Starting workers:");
	api.log("");
	for (var i = 0; i < api.os.cpus().length; i++) {
	    api.cluster.fork();
	}
	next();
}

actionHero.singleThreadComplete = function(api, next){
	api.log("");
	api.log("*** Server Started @ " + api.utils.sqlDateTime() + " @ web port " + api.configData.webServerPort + " & socket port " + api.configData.socketServerPort + " ***", ["green", "bold"]);
	api.log("");
	next();
}

actionHero.initWorkerComplete = function(api){
	api.log("worker pid "+process.pid+" started", "green");
}

////////////////////////////////////////////////////////////////////////////
// GO!

actionHero.start = function(params, callback){
	if (params == null){params = {};}
	// the api namespace.  Everything uses this.
	if(params.api == null){
		var api = {};
	}else{
		var api = params.api
	}

	api.util = require("util");
	api.exec = require('child_process').exec;
	api.net = require("net");
	api.http = require("http");
	api.url = require("url");
	api.path = require("path");
	api.fs = require("fs");
	api.cluster = require("cluster");
	api.os = require('os');
	api.mysql = require('mysql');
	api.SequelizeBase = require("sequelize");
	api.request = require("request");
	api.expressServer = require('express');
	api.form = require('connect-form');
	api.async = require('async');
	api.crypto = require("crypto");
	api.consoleColors = require('colors');
	api.log = actionHero.log;

	api.webApp = api.expressServer.createServer(
		api.form({ keepExtensions: true })
	);
	api.webApp.use(api.expressServer.cookieParser());

	api.path.exists('./config.json', function (exists) {
		if(exists){
			api.configData = JSON.parse(api.fs.readFileSync('./config.json','utf8'));
		}else{
			var defualtConfigFile = "./node_modules/actionHero/config.json";
			if(params.configChanges == null){
				if (api.cluster.isMaster) { api.log('no local config.json found nor no provided configChanges; using default from '+defualtConfigFile, "red"); }
			}else{
				if (api.cluster.isMaster) {
					api.log("configChanges found to default template in "+defualtConfigFile+":");
					api.log(JSON.stringify(params.configChanges));
				}
			}
			api.configData = JSON.parse(api.fs.readFileSync(defualtConfigFile,'utf8'));
		}

		for (var i in params.configChanges){ api.configData[i] = params.configChanges[i];}

		api.stats = {};
		api.stats.numberOfWebRequests = 0;
		api.stats.numberOfSocketRequests = 0;
		api.stats.startTime = new Date().getTime();	

		if (api.cluster.isMaster) {
			actionHero.initLogFolder(api, function(){
				actionHero.initRequires(api, function(){
					actionHero.initDB(api, function(){
						actionHero.initCron(api, function(){
							actionHero.initActions(api, function(){
								actionHero.initPostVariables(api, function(){
									if(api.configData.cluster){
										if(typeof params.initFunction == "function"){
											params.initFunction(api, function(){
												actionHero.initMasterComplete(api, function(){
													if(callback != null){ process.nextTick(function() { callback(api); }); }
												});
											})
										}else{
											actionHero.initMasterComplete(api, function(){
												if(callback != null){ process.nextTick(function() { callback(api); }); }
											});
										}
									}else{
										actionHero.initWebListen(api, function(){
											actionHero.initSocketServerListen(api, function(){
												if(typeof params.initFunction == "function"){
													params.initFunction(api, function(){
														actionHero.singleThreadComplete(api, function(){
															if(callback != null){ process.nextTick(function() { callback(api); }); }
														});
													})
												}else{
													actionHero.singleThreadComplete(api, function(){
														if(callback != null){ process.nextTick(function() { callback(api); }); }
													});
												}
											});
										});
									}
								});
							});
						});
					});
				});
			});

			api.cluster.on('death', function(worker) {
				api.log('worker ' + worker.pid + ' died', ["red", "bold"]);
				api.log('starting a new worker...', "yellow");
				api.cluster.fork();
			});

		}else{
			actionHero.initLogFolder(api, function(){
				actionHero.initRequires(api, function(){
					actionHero.initDB(api, function(){
						actionHero.initActions(api, function(){
							actionHero.initPostVariables(api, function(){
								actionHero.initWebListen(api, function(){
									actionHero.initSocketServerListen(api, function(){
										if(typeof params.initFunction == "function"){
											params.initFunction(api, function(){
												actionHero.initWorkerComplete(api);
											})
										}else{
											actionHero.initWorkerComplete(api);
										}
									});
								});
							});
						});
					});
				});
			});
		}

	});
}

exports.actionHero = actionHero;