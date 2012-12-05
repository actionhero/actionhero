////////////////////////////////////////////////////////////////////////////
// actionHero Framweork in node.js
// evan@evantahler.com 
// https://github.com/evantahler/actionHero

var actionHero = function(){
	var self = this;

	self.initalizers = {};
	self.api = {};

	self.api.connections = {};

	// core packages for the API
	self.api.util = require("util");
	self.api.exec = require('child_process').exec;
	self.api.fork = require('child_process').fork;
	self.api.net = require("net");
	self.api.tls = require("tls");
	self.api.http = require("http");
	self.api.https = require("https");
	self.api.url = require("url");
	self.api.fs = require("fs");
	self.api.path = require("path");
	self.api.os = require('os');
	self.api.formidable = require('formidable');
	self.api.request = require("request");
	self.api.async = require('async');
	self.api.crypto = require("crypto");
	self.api.consoleColors = require('colors');
	self.api.data2xml = require('data2xml');
	self.api.mime = require('mime');
	self.api.redisPackage = require('redis');
	self.api.cluster = require('cluster');
	self.api.io = require('socket.io');
	self.api.bf = require('browser_fingerprint');
	self.api.argv = require('optimist').argv;

	// backwards compatibility for old node versions
	self.api.fs.existsSync || (self.api.fs.existsSync = self.api.path.existsSync);
	self.api.fs.exists || (self.api.fs.exists = self.api.path.exists);
	try{ self.api.domain = require("domain"); }catch(e){ }
}
	
	
actionHero.prototype.start = function(params, next){
	var self = this;
	self.api._self = self;
	self.api._commands = {
		start: self.start,
		stop: self.stop,
		restart: self.restart,
	}

	self.api.running = true;

	if (params == null){params = {};}
	self.startingParams = params;

	var initializerFolders = [ 
		process.cwd() + "/initializers/", 
		__dirname + "/initializers/"
	]
		
	var initializerMethods = [];
	for(var i in initializerFolders){
		var folder = initializerFolders[i];
		if(self.api.fs.existsSync(folder)){
			self.api.fs.readdirSync(folder).sort().forEach( function(file) {
				if (file[0] != "."){
					var initalizer = file.split(".")[0];
					if(require.cache[initializerFolders[i] + file] != null){
						delete require.cache[initializerFolders[i] + file];
					}
					initializerMethods.push(initalizer);
					self.initalizers[initalizer] = require(initializerFolders[i] + file)[initalizer];
				}
			});
		}
	}
		
	self.api.utils = require(__dirname + '/helpers/utils.js').utils;

	// run the initializers
	var orderedInitializers = {}
	orderedInitializers['initConfig'] = function(next){ self.initalizers.initConfig(self.api, self.startingParams, next) };
	orderedInitializers['initID'] = function(next){ self.initalizers.initID(self.api, next) };
	orderedInitializers['initPids'] = function(next){ self.initalizers.initPids(self.api, next) };
	orderedInitializers['initLog'] = function(next){ self.initalizers.initLog(self.api, next) };
	orderedInitializers['initExceptions'] = function(next){ self.initalizers.initExceptions(self.api, next) };
	orderedInitializers['initRedis'] = function(next){ self.initalizers.initRedis(self.api, next) };
	orderedInitializers['initCache'] = function(next){ self.initalizers.initCache(self.api, next) };
	orderedInitializers['initActions'] = function(next){ self.initalizers.initActions(self.api, next) };
	orderedInitializers['initPostVariables'] = function(next){ self.initalizers.initPostVariables(self.api, next) };
	orderedInitializers['initFileServer'] = function(next){ self.initalizers.initFileServer(self.api, next) };
	orderedInitializers['initStats'] = function(next){ self.initalizers.initStats(self.api, next) };
	orderedInitializers['initChatRooms'] = function(next){ self.initalizers.initChatRooms(self.api, next) };
	orderedInitializers['initTasks'] = function(next){ self.initalizers.initTasks(self.api, next) };

	initializerMethods.forEach(function(method){
		if(typeof orderedInitializers[method] != "function"){
			orderedInitializers[method] = function(next){ 
				self.api.log("running custom initalizer: " + method);
				self.initalizers[method](self.api, next) 
			};
		}
	});

	['initWebServer', 'initWebSockets', 'initSocketServer'].forEach(function(finalInitializer){
		delete orderedInitializers[finalInitializer];
		orderedInitializers[finalInitializer] = function(next){ self.initalizers[finalInitializer](self.api, next) };
	});

	orderedInitializers['startProcessing'] = function(next){ self.api.tasks.startTaskProcessing(self.api, next) };
	orderedInitializers['_complete'] = function(){ 
		self.api.pids.writePidFile();
		var successMessage = "*** Server Started @ " + self.api.utils.sqlDateTime() + " ***";
		self.api.bootTime = new Date().getTime();
		self.api.log("server ID: " + self.api.id);
		self.api.log(successMessage, ["green", "bold"]);
		if(next != null){ 
			next(null, self.api);
		}
	};

	self.api.async.series(orderedInitializers);
};

actionHero.prototype.stop = function(next){	
	var self = this;
	if(self.api.running == true){
		self.api.running = false;
		self.api.log("Shutting down open servers and pausing tasks", "bold");

		var orderedTeardowns = {};
		orderedTeardowns['watchedFiles'] = function(next){ 
			self.api.log(" > teardown: watchedFiles", 'gray');
			for(var i in self.api.watchedFiles){
				self.api.fs.unwatchFile(self.api.watchedFiles[i]);
			}
			next();
		}

		for(var i in self.api){
			if(typeof self.api[i]._teardown == "function"){
				(function(name) {
					orderedTeardowns[name] = function(next){ 
						self.api.log(" > teardown: " + name, 'gray');
						self.api[name]._teardown(self.api, next); 
					};
				})(i)
			}
		}

		orderedTeardowns['_complete'] = function(){ 
			self.api.pids.clearPidFile();
			self.api.log("The actionHero has been stopped", "bold");
			self.api.log("***");
			if(typeof next == "function"){ next(null, self.api); }
		}

		self.api.async.series(orderedTeardowns);
	}else{
		self.api.log("Cannot shut down (not running any servers)");
		if(typeof next == "function"){ next(null, self.api); }
	}
};

actionHero.prototype.restart = function(next){
	var self = this;

	if(self.api.running == true){
		self.stop(function(err){
			self.start(self.startingParams, function(err, api){
				api.log('actionHero restarted', "green");
				if(typeof next == "function"){ next(null, self.api); } 
			});
		});
	}else{
		self.start(self.startingParams, function(err, api){
			api.log('actionHero restarted', "green");
			if(typeof next == "function"){ next(null, self.api); } 
		});
	}
};

exports.actionHeroPrototype = actionHero;