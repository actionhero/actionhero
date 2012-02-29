// load in the actionHero class
var actionHero = require(__dirname + "/../api.js").actionHero; // normally if installed by npm: var actionHero = require("actionHero").actionHero;

// if there is no config.js file in the application's root, then actionHero will load in a collection of default params.  You can overwrite them with params.configChanges
var params = {};
params.configChanges = {
	
	"webServerPort" : 8082,
	"socketServerPort" : 5002,
	
	"logFile" : "api_peer_3.log",
	
	"actionCluster": {
		"Key" : "4ijhaijhm43yjnawhja43jaj",
		"ReConnectToLostPeersMS" : 1000,
		"CycleCheckTimeMS" : 10,
		"remoteTimeoutWaitMS" : 5000,
		"nodeDuplication" : 2,
		"StartingPeer" : {
			"host": "127.0.0.1",
			"port": "5000"
		}
	},
	
	"flatFileDirectory" : "./public/"
}

// any additional functions you might wish to define to be globally accessable can be added as part of params.initFunction.  The api object will be availalbe.
params.initFunction = function(api, next){
	api.showCacheData = function(api){
		api.log("--------- CACHE --------");
		for (var i in api.cache.data){
			api.log("  "+i)
		}
		setTimeout(api.showCacheData, 5000, api);
	}
	setTimeout(api.showCacheData, 5000, api);
	
	next();
}

// start the server!
actionHero.start(params, function(api){
	api.log("Boot Sucessful!");
});