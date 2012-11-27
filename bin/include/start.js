exports['start'] = function(binary, next){

	try{
		var actionHeroPrototype = require("actionHero").actionHeroPrototype;
	}catch(e){
		var actionHeroPrototype = require(__dirname + "/../../actionHero.js").actionHeroPrototype;
	}

	var actionHero = new actionHeroPrototype();

	var title = process.title;

	// if there is no config.js file in the application's root, then actionHero will load in a collection of default params.
	// You can overwrite them with params.configChanges
	var params = {};
	params.configChanges = {};

	// start the server!
	var startServer = function(next){
		if(binary.cluster.isWorker){ process.send("starting"); }

		actionHero.start(params, function(err, api_from_callback){
			if(err){
				console.log(err);
				process.exit();
			}else{
				api = api_from_callback;
				api.log("Boot Sucessful @ pid #" + process.pid, "green");
				if(typeof next == "function"){
					if(binary.cluster.isWorker){ process.send("started"); }
					next(api);
				}
			}
		});
	}

	// handle signals from master if running in cluster
	if(binary.cluster.isWorker){
		process.on('message', function(msg) {
			if(msg == "start"){
				process.send("starting");
				startServer(function(){
					process.send("started");
				});
			}
			else if(msg == "stop"){
				process.send("stopping");
				actionHero.stop(function(err, api_from_callback){
					api = null;
					process.send("stopped");
					process.exit();
				});
			}
			else if(msg == "restart"){
				process.send("restarting");
				actionHero.restart(function(err, api_from_callback){
					api = api_from_callback;
					process.send("restarted");
				});
			}
		});
	}

	// always try to shutdown politely
	process.on('exit', function(){
		try{
			actionHero.stop(function(){});
		}catch(e){
			console.log(e)
		}
	});

	// start the server!
	startServer(function(api){
		api.log("Successfully Booted!", ["green", "bold"]);
		next();
	});

}