////////////////////////////////////////////////////////////////////////////
// actionHero Framweork in node.js
// evan@evantahler.com 
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
		api.fork = require('child_process').fork;
		api.net = require("net");
		api.http = require("http");
		api.https = require("https");
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
		api.mime = require('mime');
		api.redisPackage = require('redis');
		api.cluster = require('cluster');
				
		// backwards compatibility for old node versions
		if(process.version.split(".")[0] == "v0" && process.version.split(".")[1] <= "6"){
			api.fs.existsSync = api.path.existsSync;
			api.fs.exists = api.path.exists;
		}

		if(api.fs.existsSync('./config.json')){
			try{
				api.configData = JSON.parse(api.fs.readFileSync('./config.json','utf8'));
			}catch(e){
				console.log("Problem reading ./config.JSON");
				process.exit();
			}
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
	
		var initializerFolders = [ 
			process.cwd() + "/initializers/", 
			process.cwd() + "/node_modules/actionHero/initializers/"
		]
			
		for(var i in initializerFolders){
			var folder = initializerFolders[i];
			if(api.path.existsSync(folder)){
				api.fs.readdirSync(folder).forEach( function(file) {
					if (file != ".DS_Store"){
						var initalizer = file.split(".")[0];
						if(require.cache[initializerFolders[i] + file] != null){
							delete require.cache[initializerFolders[i] + file];
						}
						actionHero[initalizer] = require(initializerFolders[i] + file)[initalizer];
					}
				});
			}
		}
			
		api.utils = require(__dirname + '/utils.js').utils;

		// determine my unique ID
		var externalIP = api.utils.getExternalIPAddress();
		if(externalIP == false){
			console.log("Error fetching this host's external IP address; setting to random string")
			externalIP = api.utils.randomString(128);
		}
		api.id = externalIP + ":" + api.configData.webServerPort + "&" + api.configData.socketServerPort;
		if(api.cluster.isWorker){
			api.id += ":" + process.pid;
		}

		var successMessage = "*** Server Started @ " + api.utils.sqlDateTime() + " @ web port " + api.configData.webServerPort;
		if(api.configData.secureWebServer.enable){
			successMessage += " & secure web port " + api.configData.secureWebServer.port;
		}
		successMessage += " & socket port " + api.configData.socketServerPort + " ***";

		api.bootTime = new Date().getTime();
			
		actionHero.initLog(api, function(){
			api.log("server ID: " + api.id);
			actionHero.initRedis(api, function(){
				actionHero.initCache(api, function(){
					actionHero.initStats(api, function(){
						actionHero.initActions(api, function(){
							actionHero.initPostVariables(api, function(){
								actionHero.initFileServer(api, function(){
									actionHero.initWebServer(api, function(){
										actionHero.initSocketServer(api, function(){ 
											actionHero.initTasks(api, function(){
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
	};

	actionHero.stop = function(next){	
		if(actionHero.running == true){
			actionHero.api.log("Shutting down open servers (:"+actionHero.api.configData.webServerPort+", :"+actionHero.api.configData.socketServerPort+") and pausing tasks", "bold");
			clearTimeout(actionHero.api.tasks.processTimer);
			
			// remove from the list of hosts
			if(actionHero.api.redis.enable){
				actionHero.api.redis.client.llen("actionHero::peers", function(err, length){
					actionHero.api.redis.client.lrange("actionHero::peers", 0, length, function(err, peers){
						actionHero.api.redis.client.lrem("actionHero::peers", 1, actionHero.api.id, function(err, count){
							if(count != 1){ actionHero.api.log("Error removing myself from the peers list", "red"); }
							cont();
						});
					});
				});
			}else{
				cont();
			}

			function cont(){
				var closed = 0;
				var neededClosed = 2;
				if(actionHero.api.configData.secureWebServer.enable){ neededClosed++; }
				var checkForDone = function(){
					if(closed == neededClosed){
						closed = -1;
						actionHero.running = false;
						actionHero.api.log("The actionHero has been stopped", "bold");
						next(true);
					}else{
						// actionHero.api.log("waiting for open ports to close...");
					}
				}

				for(var i in actionHero.api.socketServer.connections){
					actionHero.api.socketServer.connections[i].end("Server going down NOW");
					actionHero.api.socketServer.connections[i].destroy();
				}

				actionHero.api.socketServer.server.on("close", function(){
					actionHero.api.log("Closed socket-server");
					closed++;
					checkForDone();
				});

				actionHero.api.webServer.webApp.on("close", function(){
					actionHero.api.log("Closed web-server");
					closed++;
					checkForDone();
				});

				if(actionHero.api.configData.secureWebServer.enable){
					actionHero.api.webServer.secureWebApp.on("close", function(){
						actionHero.api.log("Closed secure web-server");
						closed++;
						checkForDone();
					});
				}

				actionHero.api.socketServer.server.close();
				actionHero.api.webServer.webApp.close();
				if(actionHero.api.configData.secureWebServer.enable){ actionHero.api.webServer.secureWebApp.close(); }
				checkForDone(closed);
			}
		}else{
			actionHero.api.log("Cannot shut down, as I'm not running @ (:"+actionHero.api.configData.webServerPort+", :"+actionHero.api.configData.socketServerPort+")");
			next(false);
		}
	};

	actionHero.restart = function(next){
		if(actionHero.running == true){
			actionHero.stop(function(){
				console.log("HERE")
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