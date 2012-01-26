////////////////////////////////////////////////////////////////////////////
// actionHero Framweork in node.js
// evantahler@gmail.com
// https://github.com/evantahler/actionHero

var actionHero = {};

actionHero.start = function(params, callback){
	
	actionHero.initializers = [ 
		"initLog", 
		"initDB", 
		"initStats",
		"initPostVariables", 
		"initActions", 
		"initCron", 
		"initFileServer",
		"initWebServer", 
		"initSocketServer", 
		"initCache",
		"initActionCluster"
	];
	
	for(var i in actionHero.initializers){
		var p = actionHero.initializers[i];
		actionHero[p] = require(__dirname + '/initializers/'+p+'.js')[p];
	}
	
	if (params == null){params = {};}
	
	// the api namespace.  Everything uses this.
	if(params.api == null){
		var api = {};
	}else{
		var api = params.api
	}

	// core packages for the API
	api.util = require("util");
	api.exec = require('child_process').exec;
	api.net = require("net");
	api.http = require("http");
	api.url = require("url");
	api.path = require("path");
	api.fs = require("fs");
	api.os = require('os');
	api.formidable = require('formidable');
	api.request = require("request");
	api.async = require('async');
	api.crypto = require("crypto");
	api.consoleColors = require('colors');

	if(api.path.existsSync('./config.json')){
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
		
	api.utils = require(__dirname + '/utils.js').utils;
		
	var successMessage = "*** Server Started @ " + api.utils.sqlDateTime() + " @ web port " + api.configData.webServerPort + " & socket port " + api.configData.socketServerPort + " ***";

	actionHero.initLog(api, function(){
			
		api.tasks = {};
		var taskFile = process.cwd() + "/tasks.js";
		if(!api.path.existsSync(taskFile)){
			taskFile = __dirname + "/tasks.js";
			api.log("no ./tasks.js file in project, loading defaults tasks from  "+taskFile, "yellow");
		}
		api.tasks = require(taskFile).tasks;
			
		actionHero.initDB(api, function(){
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
														if(callback != null){ process.nextTick(function() { callback(api); }); }
													})
												}else{
													api.log(successMessage, ["green", "bold"]);
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
}

exports.actionHero = actionHero;