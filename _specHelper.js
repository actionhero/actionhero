var specHelper = {}
var showLogs = false;
specHelper.fs = require('fs');
specHelper.vows = require('vows');
specHelper.net = require('net');
specHelper.assert = require('assert');
specHelper.request = require('request');
specHelper.utils = require('./utils.js').utils;
specHelper.apis = [];
specHelper.actionHeroes = [];
specHelper.url = "127.0.0.1";
specHelper.params = [];

var baseActionHero = require(__dirname + "/api.js").createActionHero;

specHelper.params[0] = {
	"flatFileDirectory":"./public/",
	"webServerPort" : 9000,
	"socketServerPort" : 6000,
	"logging":showLogs,
	"cache" : {
		"cacheFile" : "test_cache_1.cache",
		"defaultExpireTimeSeconds" : 3600,
		"cacheFolder" : "./cache/",
		"maxMemoryBytes" : 524288000
	},
	
	"actionCluster": {
		"Key" : "4ijhaijhm43yjnawhja43jaj",
		"ReConnectToLostPeersMS" : 1000,
		"CycleCheckTimeMS" : 100,
		"remoteTimeoutWaitMS" : 1000,
		"nodeDuplication" : 2,
		"StartingPeer" : {
			"host": null,
			"port": null
		}
	}
};

specHelper.params[1] = {
	"flatFileDirectory":"./public/",
	"webServerPort" : 9001,
	"socketServerPort" : 6001,
	"logging":showLogs,
	"cache" : {
		"cacheFile" : "test_cache_2.cache",
		"defaultExpireTimeSeconds" : 3600,
		"cacheFolder" : "./cache/",
		"maxMemoryBytes" : 524288000
	},
	
	"actionCluster": {
		"Key" : "4ijhaijhm43yjnawhja43jaj",
		"ReConnectToLostPeersMS" : 1000,
		"CycleCheckTimeMS" : 100,
		"remoteTimeoutWaitMS" : 1000,
		"nodeDuplication" : 2,
		"StartingPeer" : {
			"host": specHelper.url,
			"port": specHelper.params[0].socketServerPort
		}
	}
};

specHelper.params[2] = {
	"flatFileDirectory":"./public/",
	"webServerPort" : 9002,
	"socketServerPort" : 6002,
	"logging":showLogs,
	"cache" : {
		"cacheFile" : "test_cache_3.cache",
		"defaultExpireTimeSeconds" : 3600,
		"cacheFolder" : "./cache/",
		"maxMemoryBytes" : 524288000
	},
	
	"actionCluster": {
		"Key" : "4ijhaijhm43yjnawhja43jaj",
		"ReConnectToLostPeersMS" : 1000,
		"CycleCheckTimeMS" : 100,
		"remoteTimeoutWaitMS" : 1000,
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
	try{ specHelper.fs.unlinkSync(specHelper.params[serverID].cache.cacheFolder + specHelper.params[serverID].cache.cacheFile); }catch(e){ }
	specHelper.startServer(serverID, function(api){
		next(api);
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
			// console.log(" >> starting test actionHero server on ports "+specHelper.params[serverID].webServerPort+" (webServerPort) and "+specHelper.params[serverID].socketServerPort+" (socketServerPort)");
			specHelper.actionHeroes[serverID] = new baseActionHero;
			specHelper.actionHeroes[serverID].start({configChanges: specHelper.params[serverID]}, function(api){
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
	if(serverID == null){serverID = 0};
	// console.log(" << stopping test actionHero server on ports "+specHelper.params[serverID].webServerPort+" (webServerPort) and "+specHelper.params[serverID].socketServerPort+" (socketServerPort)");
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