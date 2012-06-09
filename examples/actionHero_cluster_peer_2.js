// load in the actionHero class
var actionHero = require(__dirname + "/../api.js").actionHero; // normally if installed by npm: var actionHero = require("actionHero").actionHero;

// if there is no config.js file in the application's root, then actionHero will load in a collection of default params.  You can overwrite them with params.configChanges
var params = {};
params.configChanges = {
	
	"webServerPort" : 8081,
	"socketServerPort" : 5001,

	"redis" : {
		"enable": true,
		"host": "127.0.0.1",
		"port": 6379,
		"password": null,
		"options": null,
		"DB": 0
	},

	"secureWebServer" : {
		"port": 4444,
		"enable": true,
		"keyFile": "./certs/server-key.pem",
		"certFile": "./certs/server-cert.pem"
	},
	
	"logFile" : "api_peer_2.log",
	
	"flatFileDirectory" : "./public/"
}

// any additional functions you might wish to define to be globally accessable can be added as part of params.initFunction.  The api object will be availalbe.
params.initFunction = function(api, next){
	// api.showCacheData = function(api){
	// 	api.log("--------- CACHE --------");
	// 	for (var i in api.cache.data){
	// 		api.log("  "+i)
	// 	}
	// 	setTimeout(api.showCacheData, 5000, api);
	// }
	// setTimeout(api.showCacheData, 5000, api);
	
	next();
}

// start the server!
actionHero.start(params, function(api){
	api.log("Boot Sucessful!");
});