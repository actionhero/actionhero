////////////////////////////////////////////////////////////////////////////
// actionHero Framweork in node.js
// evan@evantahler.com 
// https://github.com/evantahler/actionHero

var createActionHero = function(){
	
	var actionHero = new Object;
	actionHero.running = false;
	
	actionHero.start = function(params, next){
				
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
		api.tls = require("tls");
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
		api.bf = require('browser_fingerprint');
				
		// backwards compatibility for old node versions
		api.fs.existsSync || (api.fs.existsSync = api.path.existsSync);
		api.fs.exists || (api.fs.exists = api.path.exists);
		try{ api.domain = require("domain"); }catch(e){ }

		api.watchedFiles = [];

		if(api.fs.existsSync(process.cwd() + '/config.js')){
			var configFile = process.cwd() + '/config.js';
		}else{
			var configFile = __dirname + "/config.js";
			console.log(' >> no local config.json, using default from '+configFile);
		}
		api.configData = require(configFile).configData;
		if(params.configChanges != null){
			// console.log(" >> using configChanges as overrides to default template: " + JSON.stringify(params.configChanges));
			for (var i in params.configChanges){ 
				var collection = params.configChanges[i];
				for (var j in collection){
					api.configData[i][j] = collection[j];
				}
			}
		}
		if(api.configData.general.developmentMode == true){
			api.watchedFiles.push(configFile);
			(function() {
				api.fs.watchFile(configFile, {interval:1000}, function(curr, prev){
					if(curr.mtime > prev.mtime){
						console.log("\r\n\r\n*** rebooting due to config change ***\r\n\r\n");
						delete require.cache[configFile];
						actionHero.restart();
					}
				});
			})();
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

		api.connections = {}; // container for future client connections

		// determine my unique ID
		var externalIP = api.utils.getExternalIPAddress();
		if(externalIP == false){
			console.log("Error fetching this host's external IP address; setting to random string")
			externalIP = api.utils.randomString(128);
		}
		api.id = externalIP;
		if(actionHero.api.configData.httpServer.enable){ api.id += ":" + api.configData.httpServer.port }
		if(actionHero.api.configData.tcpServer.enable){ api.id += ":" + api.configData.tcpServer.port }
		if(api.cluster.isWorker){ api.id += ":" + process.pid; }

		var successMessage = "*** Server Started @ " + api.utils.sqlDateTime() + " ***";
		api.bootTime = new Date().getTime();

		// run the initializers
		api.async.series({
			initLog: function(next){ actionHero.initLog(api, next); },
			initExceptions: function(next){ actionHero.initExceptions(api, next); },
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
			_complete: function(){
				api.log("server ID: " + api.id);
				api.log(successMessage, ["green", "bold"]);
				actionHero.running = true;
				if(next != null){ next(null, api); }
			},
		});
	};

	actionHero.stop = function(next){	
		if(actionHero.running == true){
			actionHero.api.log("Shutting down open servers and pausing tasks", "bold");
			for(var i in actionHero.api.watchedFiles){
				actionHero.api.fs.unwatchFile(actionHero.api.watchedFiles[i]);
			}
			for(var worker_id in actionHero.api.tasks.processTimers){
				clearTimeout(actionHero.api.tasks.processTimers[worker_id]);
			}
			// allow running timers to finish, but do no work on next cycle.
			actionHero.api.tasks.process = function(api, worker_id){ }

			var cont = function(){
				var closed = 0;
				var neededClosed = 0;
				if(actionHero.api.configData.httpServer.enable){ neededClosed++; }
				if(actionHero.api.configData.tcpServer.enable){ neededClosed++; }
				
				var checkForDone = function(serverType){
					if(serverType != null){
						actionHero.api.log("The " + serverType + " server has ended its connections and closed");
					}
					if(closed == neededClosed){
						closed = -1;
						actionHero.running = false;
						actionHero.api.log("The actionHero has been stopped", "bold");
						next(null, actionHero.api);
					}
				}

				if(actionHero.api.configData.httpServer.enable){
					actionHero.api.webServer.server.on("close", function(){
						for(var i in actionHero.api.webServer.clientClearTimers){ clearTimeout(actionHero.api.webServer.clientClearTimers[i]); }
						closed++;
						checkForDone("http");
					});
					if(actionHero.api.configData.webSockets.enable){
						actionHero.api.webSockets.disconnectAll(actionHero.api, function(){
							actionHero.api.webServer.server.close();
						});
					}else{
						actionHero.api.webServer.server.close();
					}
				}

				if(actionHero.api.configData.tcpServer.enable){
					actionHero.api.socketServer.gracefulShutdown(actionHero.api, function(){
						closed++;
						checkForDone("tcpServer");
					});
				}
				//
				checkForDone();
			}
			
			// remove from the list of hosts
			if(actionHero.api.redis.enable){
				clearTimeout(actionHero.api.redis.pingTimer);
    			clearTimeout(actionHero.api.redis.lostPeerTimer);
				actionHero.api.redis.client.lrem("actionHero:peers", 1, actionHero.api.id, function(err, count){
					if(count != 1){ actionHero.api.log("Error removing myself from the peers list", "red"); }
					actionHero.api.redis.client.hdel("actionHero:peerPings", actionHero.api.id, function(){
						cont();
					});
				});
			}else{
				cont();
			}
		}else{
			actionHero.api.log("Cannot shut down (not running any servers)");
			next(true);
		}
	};

	actionHero.restart = function(next){
		if(actionHero.running == true){
			actionHero.stop(function(){
				actionHero.start(actionHero.startngParams, function(){
					if(typeof next == "function"){ next(null, actionHero.api); } 
				});
			});
		}else{
			actionHero.start(actionHero.startngParams, function(){
				if(typeof next == "function"){ next(null, actionHero.api); } 
			});
		}
	};

	return actionHero;
}

exports.actionHero = createActionHero();
exports.createActionHero = createActionHero;