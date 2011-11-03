////////////////////////////////////////////////////////////////////////////
// DAVE API Framweork in node.js
// Evan Tahler @ Fall 2011

////////////////////////////////////////////////////////////////////////////
// Init
function initRequires(api, next)
{
	api.utils = require("./utils.js").utils;
	api.log = require("./logger.js").log;
	api.tasks = require("./tasks.js").tasks;
	api.cache = require("./cache.js").cache;
	// for(var task in api.tasks){if (task != "Task"){api.log("task loaded: "+task)}}
	api.buildWebResponse = require("./webResponse.js").buildWebResponse; 
	next();
}

////////////////////////////////////////////////////////////////////////////
// Init logging folder
function initLogFolder(api, next)
{
	try { api.fs.mkdirSync(api.configData.logFolder, "777") } catch(e) {}; 
	next();
}

////////////////////////////////////////////////////////////////////////////
// DB setup
function initDB(api, next)
{
	api.dbObj = new api.SequelizeBase(api.configData.database.database, api.configData.database.username, api.configData.database.password, {
		host: api.configData.database.host,
		port: api.configData.database.port,
		logging: api.configData.database.consoleLogging
	});

	api.models = {};
	api.modelsArray = [];
	api.fs.readdirSync("./models").forEach( function(file) {
		var modelName = file.split(".")[0];
		api.models[modelName] = require("./models/" + file)['defineModel'](api);
		api.modelsArray.push(modelName); 
		api.log("model loaded: " + modelName);
	});
	api.dbObj.sync().on('success', function() {
		api.log("DB conneciton sucessfull and Objects mapped to DB tables");
	}).on('failure', function(error) {
		api.log("trouble synchronizing models and DB.  Correct DB credentials?");
		api.log(JSON.stringify(error));
		api.log("exiting");
		process.exit(1);
	})
	next();
}

////////////////////////////////////////////////////////////////////////////
// postVariable config and load
function initPostVariables(api, next)
{
	api.postVariables = api.configData.postVariables || [];
	for(var model in api.models){
		for(var attr in api.models[model].rawAttributes){
			api.postVariables.push(attr);
		}
	}
	next();
}

////////////////////////////////////////////////////////////////////////////
// populate actions
function initActions(api, next)
{
	api.actions = {};
	api.actionsArray = [];
	api.fs.readdirSync("./actions").forEach( function(file) {
			var actionName = file.split(".")[0];
			api.actions[actionName] = require("./actions/" + file)[actionName];
			api.actionsArray.push(actionName);
			api.log("action loaded: " + actionName);
		});
	next();
}

////////////////////////////////////////////////////////////////////////////
// Periodic Tasks (fixed timer events)
function initCron(api, next)
{
	if (api.configData.cronProcess)
	{
		api.processCron = require("./cron.js").processCron;
		api.cronTimer = setTimeout(api.processCron, api.configData.cronTimeInterval, api);
		api.log("periodic (internal cron) interval set to process evey " + api.configData.cronTimeInterval + "ms");
	}
	next();
}


////////////////////////////////////////////////////////////////////////////
// Generic Action processing
function processAction(connection, next)
{
	var templateValidator = require('validator').Validator;
	connection.validator = new templateValidator();
	connection.validator.error = function(msg){ connection.error = msg; };
	
	api.models.log.count({where: ["ip = ? AND createdAt > (NOW() - INTERVAL 1 HOUR)", connection.remoteIP]}).on('success', function(requestThisHourSoFar) {
		connection.requestCounter = requestThisHourSoFar + 1;
		if(connection.params.limit == null){ connection.params.limit = api.configData.defaultLimit; }
		if(connection.params.offset == null){ connection.params.offset = api.configData.defaultOffset; }
		if(api.configData.logRequests){api.log("action @ " + connection.remoteIP + " | params: " + JSON.stringify(connection.params));}
		if(connection.requestCounter <= api.configData.apiRequestLimit || api.configData.logRequests == false)
		{
			connection.action = undefined;
			if(connection.params["action"] == undefined){
				connection.error = "You must provide an action. Use action=describeActions to see a list.";
				next(connection, true);
			}
			else{
				connection.action = connection.params["action"];
				if(api.actions[connection.action] != undefined){
					api.actions[connection.action](api, connection, next);
				}else{
					connection.error = connection.action + " is not a known action. Use action=describeActions to see a list.";
					next(connection, true);
				}
			}
		}else{
			connection.requestCounter = api.configData.apiRequestLimit;
			connection.error = "You have exceded the limit of " + api.configData.apiRequestLimit + " requests this hour.";
			next(connection, true);
		}
	});
}

function logAction(connection){
	var logRecord = api.models.log.build({
		ip: connection.remoteIP,
		action: connection.action,
		error: connection.error,
		params: JSON.stringify(connection.params)
	});
	logRecord.save();
}

////////////////////////////////////////////////////////////////////////////
// Web Request Processing
function initWebListen(api, next)
{
	api.webApp.listen(api.configData.webServerPort);
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
		
		// ignore proxy tests
		if(connection.params["action"] == "status" && connection.remoteIP == "127.0.0.1"){
			connection.res.send("OK");
		}else{
			processAction(connection, api.respondToWebClient);
		}
	});
	
	api.respondToWebClient = function(connection, cont){
		if(cont != false)
		{
			var response = api.buildWebResponse(connection);
	  		try{
				connection.res.send(response);
			}catch(e)
			{
				
			}
		}
		if(api.configData.logRequests){api.log("web request from " + connection.req.connection.remoteAddress + " | response: " + JSON.stringify(response));}
		logAction(connection) 
	};
	next();
}

////////////////////////////////////////////////////////////////////////////
// Socket Request Processing
function initSocketServerListen(api, next){
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
				processAction(connection, api.respondToSocketClient);
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
					connection.response = "OK";
				}
				api.sendSocketMessage(connection, connection.response);
			}else{
				api.sendSocketMessage(connection, connection.error);
			}
		}
	}

	//message helper
	api.sendSocketMessage = function(connection, message){
		try{ connection.write(JSON.stringify(message) + "\r\n\0"); }catch(e){ }
	}

	// listen
	api.socketServer.listen(api.configData.socketServerPort);

	next();
}
 
////////////////////////////////////////////////////////////////////////////
// final flag
function initComplete(api)
{
	api.log("*** Server Started @ " + api.utils.sqlDateTime() + " @ web port " + api.configData.webServerPort + " & socket port " + api.configData.socketServerPort + " ***");
}

////////////////////////////////////////////////////////////////////////////
// am I runnign already?
function runningCheck(api, next)
{
	api.utils.shellExec(api, "ps awx | grep api.js | grep -v '/bin/sh' | grep -v grep --count", function(response){
		if(response.stdout > 1){
			api.utils.shellExec(api, "ps awx | grep api.js | grep -v grep", function(response){
				console.log(response);
				api.log("*** The server is already running, exiting this instance ***");
				process.exit(0);
			});
		}else{
			next();
		}
	});
}

////////////////////////////////////////////////////////////////////////////
// GO!

// Force NPM to be update... you probably don't want this in production
// exec = require('child_process').exec
// exec("npm update");

var api = api = api || {}; // the api namespace.  Everything uses this.

api.sys = require("sys"),
api.exec = require('child_process').exec;
api.net = require("net"),
api.http = require("http"),
api.url = require("url"),
api.path = require("path"),
api.fs = require("fs");
api.SequelizeBase = require("sequelize");
api.expressServer = require('express');
api.async = require('async');
api.crypto = require("crypto");

api.webApp = api.expressServer.createServer();
api.webApp.use(api.expressServer.cookieParser());
api.configData = JSON.parse(api.fs.readFileSync('config.json','utf8'));

api.stats = {};
api.stats.numberOfWebRequests = 0;
api.stats.numberOfSocketRequests = 0;
api.stats.startTime = new Date().getTime();

initLogFolder(api, function(){
	initRequires(api, function(){
		runningCheck(api, function(){
			initDB(api, function(){
				initPostVariables(api, function(){
					initActions(api, function(){
						initCron(api, function(){
							initWebListen(api, function(){
								initSocketServerListen(api, function(){
									initComplete(api)
								})
							})
						})
					})
				})
			})
		})
	})
})

