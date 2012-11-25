exports['actionHeroCluster'] = function(binary, next){

	//////////////////////////////////////////////////////////////////////////////////////////////////////
	// 
	// TO START IN CONSOLE: `./bin/actionHero startClister`
	// TO DAMEONIZE: `forever ./bin/actionHero startClister` 
	// 
	// ** Producton-ready actionHero cluster example **
	// - workers which die will be restarted
	// - maser/manager specific logging
	// - pidfile for master
	// - USR2 restarts (graceful reload of workers while handling requets)
	//   -- Note, socket/websocket clients will be disconnected, but there will always be a worker to handle them
	//   -- HTTP, HTTPS, and TCP clients will be allowed to finish the action they are working on before the server goes down
	// - TTOU and TTIN signals to subtract/add workers
	// - WINCH to stop all workers
	// - TCP, HTTP(s), and Web-socket clients will all be shared across the cluster
	// - Can be run as a daemon or in-console
	//   -- Lazy Dameon: `nohup ./scripts/actionHeroCluster &`
	//   -- you may want to explore `forever` as a dameonizing option
	//
	// * Setting process titles does not work on windows or OSX
	// 
	// This example was heavily inspired by Ruby Unicorns [[ http://unicorn.bogomips.org/ ]]
	// 
	//////////////////////////////////////////////////////////////////////////////////////////////////////

	//////////////
	// Includes //
	//////////////

	var cluster = require('cluster');

	var numCPUs = require('os').cpus().length
	var numWorkers = numCPUs - 2;
	if (numWorkers < 2){ numWorkers = 2};

	try{
		var actionHero = require("actionHero").actionHero;
		var execCMD = process.cwd() + "/node_modules/actionHero/bin/actionHero";
	}catch(e){
		var actionHero = require("../../api.js").actionHero;
		var execCMD = process.cwd() + "/bin/actionHero";
	}

	var pidPath = process.cwd() + "/pids";
	try{
		stats = binary.fs.lstatSync(pidPath);
		if(!stats.isDirectory()){
			binary.fs.mkdirSync(pidPath);
		}
	}catch(e){
		binary.fs.mkdirSync(pidPath);
	}

	////////////
	// config //
	////////////

	var config = {
		exec: execCMD, 
		args: "start",
		workers: numWorkers,
		pidfile: pidPath + "/cluster_pidfile",
		log: process.cwd() + "/log/cluster.log",
		title: "actionHero-master",
		workerTitlePrefix: " actionHero-worker",
		silent: true, // don't pass stdout/err to the master
	};

	for(var i in config){
		if(binary.argv[i] != null){
			config[i] = binary.argv[i];
		}
	}

	if(config.silent == "false"){ config.silent = false; }
	if(config.silent == "true"){ config.silent = true; }

	config.args = config.args.split(",");

	binary.logWriter = binary.fs.createWriteStream((config.log), {flags:"a"});

	binary.originalLog = binary.log;
	binary.log = function(message, styles){
		binary.logWriter.write(message + "\r\n");
		binary.originalLog(message, styles);
	}

	//////////
	// Main //
	//////////
	binary.log(" - STARTING CLUSTER -", ["bold", "green"]);
	binary.log("options:");
	for(var i in config){
		binary.log(" > " + i + ": " + config[i]);
	}
	binary.log("");

	// set pidFile
	if(config.pidfile != null){
		binary.fs.writeFileSync(config.pidfile, process.pid.toString(), 'ascii');
	}

	process.stdin.resume();
	process.title = config.title;
	var workerRestartArray = []; // used to trask rolling restarts of workers
	var workersExpected = 0;

	// signals
	process.on('SIGINT', function(){
		binary.log("Signal: SIGINT");
		workersExpected = 0;
		setupShutdown();
	});
	process.on('SIGTERM', function(){
		binary.log("Signal: SIGTERM");
		workersExpected = 0;
		setupShutdown();
	});
	process.on('SIGKILL', function(){
		binary.log("Signal: SIGKILL");
		workersExpected = 0;
		setupShutdown();
	});
	process.on('SIGUSR2', function(){
		binary.log("Signal: SIGUSR2");
		binary.log("swap out new workers one-by-one");
		workerRestartArray = [];
		for(var i in cluster.workers){
			workerRestartArray.push(cluster.workers[i]);
		}
		reloadAWorker();
	});
	process.on('SIGHUP', function(){
		binary.log("Signal: SIGHUP");
		binary.log("reload all workers now");
		for (var i in cluster.workers){
			var worker = cluster.workers[i];
			worker.send("restart");
		}
	});
	process.on('SIGWINCH', function(){
		binary.log("Signal: SIGWINCH");
		binary.log("stop all workers");
		workersExpected = 0;
		for (var i in cluster.workers){
			var worker = cluster.workers[i];
			worker.send("stop");
		}
	});
	process.on('SIGTTIN', function(){
		binary.log("Signal: SIGTTIN");
		binary.log("add a worker");
		workersExpected++;
		startAWorker();
	});
	process.on('SIGTTOU', function(){
		binary.log("Signal: SIGTTOU");
		binary.log("remove a worker");
		workersExpected--;
		for (var i in cluster.workers){
			var worker = cluster.workers[i];
			worker.send("stop");
			break;
		}
	});
	process.on("exit", function(){
		workersExpected = 0;
		binary.log("Bye!")
	});

	// signal helpers
	var startAWorker = function(){
		var worker = cluster.fork();
		binary.log("starting worker #" + worker.id);
		worker.on('message', function(message){
			if(worker.state != "none"){
				binary.log("Message ["+worker.process.pid+"]: " + message);
			}
		});
	}

	var setupShutdown = function(){
		binary.log("Cluster manager quitting", "red", "bold");
		binary.log("Stopping each worker...");
		for(var i in cluster.workers){
			cluster.workers[i].send('stop');
		}
		setTimeout(loopUntilNoWorkers, 1000);
	}

	var loopUntilNoWorkers = function(){
		if(cluster.workers.length > 0){
			binary.log("there are still " + cluster.workers.length + " workers...");
			setTimeout(loopUntilNoWorkers, 1000);
		}else{
			binary.log("all workers gone");
			if(config.pidfile != null){
				binary.fs.unlinkSync(config.pidfile);
			}
			process.exit();
		}
	}

	var reloadAWorker = function(next){
		var count = 0;
		for (var i in cluster.workers){ count++; }
		if(workersExpected > count){
			startAWorker();
		}
		if(workerRestartArray.length > 0){
			var worker = workerRestartArray.pop();
			worker.send("stop");
		}
	}

	// Fork it.
	cluster.setupMaster({
		exec : config.exec,
		args: config.args,
		silent : config.silent
	});
	for (var i = 0; i < config.workers; i++) {
		workersExpected++;
		startAWorker();
	}
	cluster.on('fork', function(worker) {
		binary.log("worker " + worker.process.pid + " (#"+worker.id+") has spawned", "green");
	});
	cluster.on('listening', function(worker, address) {
		
	});
	cluster.on('exit', function(worker, code, signal) {
		binary.log("worker " + worker.process.pid + " (#"+worker.id+") has exited", "yellow");
		setTimeout(reloadAWorker, 1000) // to prevent CPU-splsions if crashing too fast
	});

}