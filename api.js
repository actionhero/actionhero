////////////////////////////////////////////////////////////////////////////
// actionHero Framweork in node.js
// evantahler@gmail.com
// https://github.com/evantahler/actionHero

var createActionHero = function(){
	
	var actionHero = new Object;
	actionHero.running = false;
	
	actionHero.start = function(params, callback){
				
		if (params == null){params = {};}
		actionHero.startngParams = params;
	
		// the api namespace.  Everything uses this.
		if(params.api == null){
			var api = {};
		}else{
			var api = params.api
		}
		actionHero.api = api;

		// core packages for the API
		api.util = require("util");
		api.exec = require('child_process').exec;
		api.net = require("net");
		api.http = require("http");
		api.url = require("url");
		api.fs = require("fs");
		api.path = require("path");
		api.os = require('os');
		api.formidable = require('formidable');
		api.request = require("request");
		api.async = require('async');
		api.crypto = require("crypto");
		api.consoleColors = require('colors');
		api.data2xml = require('data2xml');
		
		// backwards compatibility for old node versions
		if(process.version.split(".")[0] == "v0" && process.version.split(".")[1] <= "6"){
			api.fs.existsSync = api.path.existsSync;
			api.fs.exists = api.path.exists;
		}

		if(api.fs.existsSync('./config.json')){
			api.configData = JSON.parse(api.fs.readFileSync('./config.json','utf8'));
		}else{
			var defualtConfigFile = "./node_modules/actionHero/config.json";
			if(params.configChanges == null){
				console.log(' >> no local config.json found nor no provided configChanges; using default from '+defualtConfigFile);
			}else{
				console.log(" >> using configChanges as overrides to default template");
			}
			api.configData = JSON.parse(api.fs.readFileSync(defualtConfigFile,'utf8'));
		}

		// overide config.js with params.configChanges if exists 
		for (var i in params.configChanges){ api.configData[i] = params.configChanges[i];}
	
		var initPath = process.cwd() + "/initializers/";
		api.fs.exists(initPath, function (exists) {
			if(!exists){ initPath = process.cwd() + "/node_modules/actionHero/initializers/"; }
			api.fs.readdirSync(initPath).forEach( function(file) {
				if (file != ".DS_Store"){
					var initalizer = file.split(".")[0];
					actionHero[initalizer] = require(initPath + file)[initalizer];
				}
			});

			api.utils = require(__dirname + '/utils.js').utils;
			var successMessage = "*** Server Started @ " + api.utils.sqlDateTime() + " @ web port " + api.configData.webServerPort + " & socket port " + api.configData.socketServerPort + " ***";
			actionHero.initLog(api, function(){
			
				api.tasks = {};
				var taskFile = process.cwd() + "/tasks.js";
				if(!api.fs.existsSync(taskFile)){
					taskFile = __dirname + "/tasks.js";
					api.log("no ./tasks.js file in project, loading defaults tasks from  "+taskFile, "yellow");
				}
				api.tasks = require(taskFile).tasks;

				actionHero.initCron(api, function(){
					actionHero.initCache(api, function(){
						actionHero.initStats(api, function(){
							actionHero.initActions(api, function(){
								actionHero.initPostVariables(api, function(){
									actionHero.initFileServer(api, function(){
										actionHero.initWebServer(api, function(){
											actionHero.initSocketServer(api, function(){ 
												actionHero.initActionCluster(api, function(){
													if(typeof params.initFunction == "function"){
														params.initFunction(api, function(){
															api.log(successMessage, ["green", "bold"]);
															actionHero.running = true;
															if(callback != null){ process.nextTick(function() { callback(api); }); }
														})
													}else{
														api.log(successMessage, ["green", "bold"]);
														actionHero.running = true;
														if(callback != null){ process.nextTick(function() { callback(api); }); }
													}
												});
											});
										});
									});
								});
							});
						});
					});
				});
			});
		});
	};

	actionHero.stop = function(next){	
		if(actionHero.running == true)
		{
			actionHero.api.log("Shutting down open servers (:"+actionHero.api.configData.webServerPort+", :"+actionHero.api.configData.socketServerPort+") and pausing tasks", "bold");
			var closed = 0;
			var checkForDone = function(closed){
				if(closed == 2){
					actionHero.running = false;
					actionHero.api.log("The actionHero has been stopped", "bold");
					next(true);
				}else{
					actionHero.api.log("waiting for open ports to close...");
				}
			}
	
			actionHero.api.socketServer.server.on("close", function(){
				actionHero.api.log("Closed socket-server");
				closed++;
				checkForDone(closed);
			});
	
			actionHero.api.webServer.webApp.on("close", function(){
				actionHero.api.log("Closed web-server");
				closed++;
				checkForDone(closed);
			});
	
			actionHero.api.socketServer.server.close();
			actionHero.api.webServer.webApp.close();
			checkForDone(closed);
			for(var i in actionHero.api.socketServer.connections){
				actionHero.api.socketServer.connections[i].end("Server going down NOW");
				actionHero.api.socketServer.connections[i].destroy();
			}
			clearTimeout(actionHero.api.cronTimer);
		}else{
			actionHero.api.log("Cannot shut down, as I'm not running @ (:"+actionHero.api.configData.webServerPort+", :"+actionHero.api.configData.socketServerPort+")");
			next(false);
		}
	};

	actionHero.restart = function(next){
		if(actionHero.running == true){
			actionHero.stop(function(){
				actionHero.start(actionHero.startngParams, function(){
					if(typeof next == "function"){ next(true); } 
				});
			});
		}else{
			actionHero.start(actionHero.startngParams, function(){
				if(typeof next == "function"){ next(true); } 
			});
		}
	};

	return actionHero;
}

exports.actionHero = createActionHero();
exports.createActionHero = createActionHero;