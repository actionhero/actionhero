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
		api.io = require('socket.io');
				
		// backwards compatibility for old node versions
		api.fs.existsSync || (api.fs.existsSync = api.path.existsSync);
		api.fs.exists || (api.fs.exists = api.path.exists);

		if(api.fs.existsSync(process.cwd() + '/config.js')){
			api.configData = require(process.cwd() + '/config.js').configData;
		}else{
			var defualtConfigFile = __dirname + "/config.js";
			if(params.configChanges == null){
				console.log(' >> no local config.json found nor no provided configChanges; using default from '+defualtConfigFile);
			}else{
				console.log(" >> using configChanges as overrides to default template");
			}
			api.configData = require(defualtConfigFile).configData;
		}

		// overide config.js with params.configChanges if exists (second depth hashes)
		for (var i in params.configChanges){ 
			var collection = params.configChanges[i];
			for (var j in collection){
				api.configData[i][j] = collection[j];
			}
		}

		var initializerFolders = [ 
			process.cwd() + "/initializers/", 
			process.cwd() + "/node_modules/actionHero/initializers/"
		]
			
		for(var i in initializerFolders){
			var folder = initializerFolders[i];
			if(api.fs.existsSync(folder)){
				api.fs.readdirSync(folder).forEach( function(file) {
					if (file[0] != "."){
						var initalizer = file.split(".")[0];
						if(require.cache[initializerFolders[i] + file] != null){
							delete require.cache[initializerFolders[i] + file];
						}
						actionHero[initalizer] = require(initializerFolders[i] + file)[initalizer];
					}
				});
			}
		}
			
		api.utils = require(__dirname + '/helpers/utils.js').utils;

		// determine my unique ID
		var externalIP = api.utils.getExternalIPAddress();
		if(externalIP == false){
			console.log("Error fetching this host's external IP address; setting to random string")
			externalIP = api.utils.randomString(128);
		}
		api.id = externalIP;
		if(actionHero.api.configData.httpServer.enable){ api.id += ":" + api.configData.httpServer.port }
		if(actionHero.api.configData.httpsServer.enable){ api.id += ":" + api.configData.httpsServer.port }
		if(actionHero.api.configData.tcpServer.enable){ api.id += ":" + api.configData.tcpServer.port }
		if(api.cluster.isWorker){ api.id += ":" + process.pid; }

		var successMessage = "*** Server Started @ " + api.utils.sqlDateTime() + " ***";
		api.bootTime = new Date().getTime();

		// run the initializers
		api.async.series({
			initLog: function(next){ actionHero.initLog(api, next); },
			initRedis: function(next){ actionHero.initRedis(api, next); },
			initCache: function(next){ actionHero.initCache(api, next); },
			initActions: function(next){ actionHero.initActions(api, next); },
			initPostVariables: function(next){ actionHero.initPostVariables(api, next); },
			initFileServer: function(next){ actionHero.initFileServer(api, next); },
			initStats: function(next){ actionHero.initStats(api, next); },
			initWebServer: function(next){ actionHero.initWebServer(api, next); },
			initWebSockets: function(next){ actionHero.initWebSockets(api, next); },
			initSocketServer: function(next){ actionHero.initSocketServer(api, next); },
			initChatRooms: function(next){ actionHero.initChatRooms(api, next); },
			initTasks: function(next){ actionHero.initTasks(api, next); },
			_user_init: function(next){
				if(typeof params.initFunction == "function"){
					params.initFunction(api, function(){
						next();
					})
				}else{
					next();
				}
			},
			startTaskProcessing: function(next){ 
				api.tasks.startTaskProcessing(api, next);
			},
			_complete: function(next){
				api.log("server ID: " + api.id);
				api.log(successMessage, ["green", "bold"]);
				actionHero.running = true;
				if(callback != null){ 
					callback(api); 
					// next();
				}else{
					// next();
				}
			},
		});
	};

	actionHero.stop = function(next){	
		if(actionHero.running == true){
			actionHero.api.log("Shutting down open servers and pausing tasks", "bold");
			clearTimeout(actionHero.api.tasks.processTimer);
			if(actionHero.api.redis.enable){
				clearTimeout(actionHero.api.redis.pingTimer);
    			clearTimeout(actionHero.api.redis.lostPeerTimer);
    		}
			
			// remove from the list of hosts
			if(actionHero.api.redis.enable){
				actionHero.api.redis.client.llen("actionHero:peers", function(err, length){
					actionHero.api.redis.client.lrange("actionHero:peers", 0, length, function(err, peers){
						actionHero.api.redis.client.lrem("actionHero:peers", 1, actionHero.api.id, function(err, count){
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
				var neededClosed = 0;
				if(actionHero.api.configData.httpServer.enable){ neededClosed++; }
				if(actionHero.api.configData.httpsServer.enable){ neededClosed++; }
				if(actionHero.api.configData.tcpServer.enable){ neededClosed++; }
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

				if(actionHero.api.configData.httpServer.enable){
					actionHero.api.webServer.webApp.on("close", function(){
						actionHero.api.log("Closed http server");
						closed++;
						checkForDone();
					});
					actionHero.api.webServer.webApp.close();
				}

				if(actionHero.api.configData.httpsServer.enable){
					actionHero.api.webServer.secureWebApp.on("close", function(){
						actionHero.api.log("Closed secure web-server");
						closed++;
						checkForDone();
					});
					actionHero.api.webServer.secureWebApp.close();
				}

				if(actionHero.api.configData.tcpServer.enable){
					actionHero.api.socketServer.server.on("close", function(){
						actionHero.api.log("Closed socket-server");
						closed++;
						checkForDone();
					});
					actionHero.api.socketServer.server.close();
				}
				//
				checkForDone(closed);
			}
		}else{
			actionHero.api.log("Cannot shut down (not running any servers)");
			next(false);
		}
	};

	actionHero.restart = function(next){
		if(actionHero.running == true){
			actionHero.stop(function(){
				actionHero.start(actionHero.startngParams, function(){
					if(typeof next == "function"){ next(true, actionHero.api); } 
				});
			});
		}else{
			actionHero.start(actionHero.startngParams, function(){
				if(typeof next == "function"){ next(true, actionHero.api); } 
			});
		}
	};

	return actionHero;
}

exports.actionHero = createActionHero();
exports.createActionHero = createActionHero;