var specHelper = {}
var showLogs = false;
specHelper.fs = require('fs');
specHelper.vows = require('vows');
specHelper.net = require('net');
specHelper.assert = require('assert');
specHelper.request = require('request');
specHelper.utils = require(__dirname + '/../helpers/utils.js').utils;
specHelper.apis = [];
specHelper.actionHeroes = [];
specHelper.url = "127.0.0.1";
specHelper.params = [];

var redisConfig = {
	"enable": true,
	"host": "127.0.0.1",
	"port": 6379,
	"password": null,
	"options": null,
	"DB": 2
}

var baseActionHero = require(__dirname + "/../api.js").createActionHero;

specHelper.params[0] = {
	general: {
		workers: 1
	},
	log: {
		logging: showLogs,
		logFile: "api_peer_1.log",
	},
	httpServer: {
		enable: true,
		port: 9000,
	},
	httpsServer: {
		enable: false,
	},
	tcpServer: {
		enable: true,
		port: 8000,
	},
	webSockets: {
		enable: false
	},
	redis : redisConfig,
};

specHelper.params[1] = {
	general: {
		workers: 1
	},
	log: {
		logging: showLogs,
		logFile: "api_peer_2.log",
	},
	httpServer: {
		enable: true,
		port: 9001,
	},
	httpsServer: {
		enable: false,
	},
	tcpServer: {
		enable: true,
		port: 8001,
	},
	webSockets: {
		enable: false
	},
	redis : redisConfig,
};

specHelper.params[2] = {
	general: {
		workers: 1
	},
	log: {
		logging: showLogs,
		logFile: "api_peer_3.log",
	},
	httpServer: {
		enable: true,
		port: 9002,
	},
	httpsServer: {
		enable: false,
	},
	tcpServer: {
		enable: true,
		port: 8002,
	},
	webSockets: {
		enable: false
	},
	redis : redisConfig,
};

specHelper.initFunction = function(api, next){
	api.redis.lostPeerCheckTime = 500;
	next();
}

specHelper.clearRedis = function(next){
	var redis = require('redis');
	var client = redis.createClient(redisConfig.port, redisConfig.host, redisConfig.options);
	client.on("ready", function (err) {
    	client.select(redisConfig.DB, function(){
    		client.flushdb(function(){
    			process.stdout.write("[ test redis emptied ] ");
    			next();
    		});
    	});
    });
    client.on("error", function (err) {
        process.stdout.write("\r\n\r\n!! Redis Error: " + err + "\r\n\r\n");
        process.exit();  // redis is really important...
    });
}

// tables to truncate each round of testing
specHelper.tables = [ "Logs" ];

specHelper.prepare = function(serverID, next){
	if(serverID == null){serverID = 0};
	specHelper.startServer(serverID, function(api){
		next(api);
	});
}

////////////////////////////////////////////////////////////////////////////
// Start Test Server
specHelper.startServer = function(serverID, next){
	if(serverID == null){serverID = 0};
	var conn = specHelper.net.createConnection(specHelper.params[serverID].httpServer.port, host=specHelper.url, function(){
		next(specHelper.apis[serverID]);
		conn.destroy();
	});
	conn.on('error', function(err) { 
		if(err.code == "ECONNREFUSED"){
			specHelper.actionHeroes[serverID] = new baseActionHero;
			if(serverID == 0){
				specHelper.clearRedis(function(){
					specHelper.actionHeroes[serverID].start({configChanges: specHelper.params[serverID], initFunction: specHelper.initFunction}, function(api){
						specHelper.apis[serverID] = api;
						conn.destroy();
						next(specHelper.apis[serverID]);
					});
				});
			}else{
				specHelper.actionHeroes[serverID].start({configChanges: specHelper.params[serverID], initFunction: specHelper.initFunction}, function(api){
					specHelper.apis[serverID] = api;
					conn.destroy();
					next(specHelper.apis[serverID]);
				});
			}
		}else{
			conn.destroy();
			next(specHelper.apis[serverID]);
		}
	}); 
}

specHelper.stopServer = function(serverID, next){
	if(serverID == null){serverID = 0};
	specHelper.actionHeroes[serverID].stop(function(resp){
		next(resp);
	});
};

specHelper.restartServer = function(serverID, next){
	if(serverID == null){serverID = 0};
	specHelper.actionHeroes[serverID].restart(function(resp, api){
		next(resp, api);
	});
};

////////////////////////////////////////////////////////////////////////////
// API request
specHelper.apiTest = {
	general: function(method, serverID, url, data, cb){
		if(serverID == null){serverID = 0};
		var params = {}
		params.method = method;
		if(url.indexOf("?") > -1){
			params.url = "http://"  + specHelper.url + ":" + specHelper.params[serverID].httpServer.port + (url||'');
		}else{
			params.url = "http://"  + specHelper.url + ":" + specHelper.params[serverID].httpServer.port + (url||'') + "?";
			for(var i in data){
				params.url += i + "=" + data[i] + "&";
			}
		}

		specHelper.request(params,function(req, res){
			try{ res.body = JSON.parse(res.body); }catch(e){};
			cb( res );
		})
	},
	get: function( url, serverID, data, cb  ){ specHelper.apiTest.general( 'GET', serverID, url, data, cb    )  },
	post: function( url, serverID, data, cb ){ specHelper.apiTest.general( 'POST', serverID, url, data, cb   )  },
	put: function( url, serverID, data, cb  ){ specHelper.apiTest.general( 'PUT', serverID, url, data, cb    )  },
	del: function( url, serverID, data, cb  ){ specHelper.apiTest.general( 'DELETE', serverID, url, data, cb )  }
}

////////////////////////////////////////////////////////////////////////////
// API object cleanup
specHelper.cleanAPIObject = function(api){
	var cleanAPI = {}
	cleanAPI["actions"] = api["actions"];
	cleanAPI["tasks"] = api["tasks"];
	cleanAPI["utils"] = api["utils"];
	cleanAPI["configData"] = api["configData"];
	cleanAPI["stats"] = api["stats"];
	cleanAPI["cache"] = api["cache"];
	cleanAPI["postVariables"] = api["postVariables"];
	return cleanAPI
}

////////////////////////////////////////////////////////////////////////////
// EXPORT
exports.specHelper = specHelper;