var specHelper = {}
var showLogs = false;
specHelper.vows = require('vows');
specHelper.net = require('net');
specHelper.assert = require('assert');
specHelper.request = require('request');
specHelper.apis = [];
specHelper.actionHeroes = [];
specHelper.url = "127.0.0.1";
specHelper.params = [];

var baseActionHero = require(__dirname + "/api.js").actionHero;

specHelper.params[0] = {
	"database" : {
		"type":"mySQL",
		"host" : specHelper.url,
		"database" : "action_hero_api_test",
		"username" : "root",
		"password" : null,
		"port" : "3306",
		"consoleLogging" : false,
	},
	"flatFileDirectory":"./public/",
	"webServerPort" : 9000,
	"socketServerPort" : 6000,
	"logging":showLogs,
	"cronProcess":false,
	"cache" : {
		"defaultExpireTimeSeconds" : 3600
	},
	
	"actionCluster": {
		"Key" : "4ijhaijhm43yjnawhja43jaj",
		"ReConnectToLostPeersMS" : 1000,
		"CycleCheckTimeMS" : 100,
		"remoteTimeoutWaitMS" : 10000,
		"nodeDuplication" : 2,
		"StartingPeer" : {
			"host": null,
			"port": null
		}
	}
};

specHelper.params[1] = {
	"database" : {
		"type":"mySQL",
		"host" : specHelper.url,
		"database" : "action_hero_api_test",
		"username" : "root",
		"password" : null,
		"port" : "3306",
		"consoleLogging" : false,
	},
	"flatFileDirectory":"./public/",
	"webServerPort" : 9001,
	"socketServerPort" : 6001,
	"logging":showLogs,
	"cronProcess":false,
	"cache" : {
		"defaultExpireTimeSeconds" : 3600
	},
	
	"actionCluster": {
		"Key" : "4ijhaijhm43yjnawhja43jaj",
		"ReConnectToLostPeersMS" : 1000,
		"CycleCheckTimeMS" : 100,
		"remoteTimeoutWaitMS" : 10000,
		"nodeDuplication" : 2,
		"StartingPeer" : {
			"host": specHelper.url,
			"port": specHelper.params[0].socketServerPort
		}
	}
};

specHelper.params[2] = {
	"database" : {
		"type":"mySQL",
		"host" : specHelper.url,
		"database" : "action_hero_api_test",
		"username" : "root",
		"password" : null,
		"port" : "3306",
		"consoleLogging" : false,
	},
	"flatFileDirectory":"./public/",
	"webServerPort" : 9002,
	"socketServerPort" : 6002,
	"logging":showLogs,
	"cronProcess":false,
	"cache" : {
		"defaultExpireTimeSeconds" : 3600
	},
	
	"actionCluster": {
		"Key" : "4ijhaijhm43yjnawhja43jaj",
		"ReConnectToLostPeersMS" : 1000,
		"CycleCheckTimeMS" : 100,
		"remoteTimeoutWaitMS" : 10000,
		"nodeDuplication" : 2,
		"StartingPeer" : {
			"host": specHelper.url,
			"port": specHelper.params[0].socketServerPort
		}
	}
};

// tables to truncate each round of testing
specHelper.tables = [ "Logs" ];

specHelper.prepare = function(serverID, next){
	if(serverID == null){serverID = 0};
	specHelper.cleanDB(serverID, function(){
		specHelper.startServer(serverID, function(api){
			next(api);
		});
	});
}

////////////////////////////////////////////////////////////////////////////
// Start Test Server
specHelper.startServer = function(serverID, next){
	if(serverID == null){serverID = 0};
	var conn = specHelper.net.createConnection(specHelper.params[serverID].webServerPort, host=specHelper.url, function(){
		next(specHelper.apis[serverID]);
		conn.destroy();
	});
	conn.on('error', function(err) { 
		if(err.code == "ECONNREFUSED"){
			console.log(" >> starting test actionHero server on ports "+specHelper.params[serverID].webServerPort+" (webServerPort) and "+specHelper.params[serverID].socketServerPort+" (socketServerPort)");
			console.log(" >> using test database: "+specHelper.params[serverID].database.database);
			specHelper.actionHeroes[serverID] = require(__dirname + "/api.js").actionHero;
			specHelper.actionHeroes[serverID].id = serverID;
			specHelper.actionHeroes[serverID].start({configChanges: specHelper.params[serverID]}, function(api){
				console.log("There are now "+specHelper.actionHeroes.length+" test servers running");
				console.log("");
				specHelper.apis[serverID] = api;
				conn.destroy();
				next(specHelper.apis[serverID]);
			});
		}else{
			conn.destroy();
			next(specHelper.apis[serverID]);
		}
	}); 
}

specHelper.stopServer = function(serverID, next){
	console.log(specHelper.actionHeroes[0].api.configData.socketServerPort);
	console.log(specHelper.actionHeroes[1].api.configData.socketServerPort);
	console.log(specHelper.actionHeroes[2].api.configData.socketServerPort);
	if(serverID == null){serverID = 0};
	specHelper.actionHeroes[serverID].stop(function(resp){
		next(resp);
	});
};

specHelper.restartServer = function(serverID, next){
	if(serverID == null){serverID = 0};
	specHelper.actionHeroes[serverID].restart(function(resp){
		next(resp);
	});
};


////////////////////////////////////////////////////////////////////////////
// Clean Test DB
specHelper.cleanDB = function(serverID, next){
	if(serverID == null){serverID = 0};
	var mysql = require('mysql');
	var mySQLparams = {
	  user: specHelper.params[serverID].database.username,
	  password: specHelper.params[serverID].database.password,
	  port: specHelper.params[serverID].database.port,
	  host: specHelper.params[serverID].database.host,
	  database: specHelper.params[serverID].database.database,
	};
	rawDBConnction = mysql.createClient(mySQLparams);

	var running = 0;
	for(var i in specHelper.tables){
		running++;
		rawDBConnction.query('TRUNCATE '+ specHelper.tables[i], function(err, rows, fields){
			running--
			if(running == 0){
				// console.log("test DB Truncated");
				next();
			}
		});
	}
}

////////////////////////////////////////////////////////////////////////////
// API request
specHelper.apiTest = {
  general: function(method, serverID, url, data, cb){
	if(serverID == null){serverID = 0};
  	var params = {}
  	params.method = method;
	if(url.indexOf("?") > -1){
		params.url = "http://"  + specHelper.url + ":" + specHelper.params[serverID].webServerPort + (url||'');
	}else{
		params.url = "http://"  + specHelper.url + ":" + specHelper.params[serverID].webServerPort + (url||'') + "?";
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