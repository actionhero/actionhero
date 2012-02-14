////////////////////////////////////////////////////////////////////////////
// Periodic Tasks (fixed timer events)

var initTasks = function(api, next)
{
	// if (api.configData.cronProcess)
	// {
	// 	api.processCron = function(api){
	// 		api.log("* periodic cron tasks starting now *");
	// 
	// 		// run all tasks every time async
	// 		var runningTasks = 0;
	// 		for(var task in api.tasks){
	// 			if (task != "Task"){
	// 				runningTasks++;
	// 				api.tasks[task](api, function(){
	// 					runningTasks--;
	// 					if(runningTasks == 0){
	// 						api.log("* periodic cron tasks comple. see you again in " + api.configData.cronTimeInterval + "ms *");
	// 						if(api.cronTimer) { clearTimeout(api.cronTimer); }
	// 						api.cronTimer = setTimeout(api.processCron, api.configData.cronTimeInterval, api);
	// 					}
	// 				});
	// 			}
	// 		}
	// 	};
	// 
	// 	api.cronTimer = setTimeout(api.processCron, api.configData.cronTimeInterval, api);
	// 	api.log("periodic (internal cron) interval set to process evey " + api.configData.cronTimeInterval + "ms", "green");
	// }
	
	api.tasks = {};
	api.tasks.tasks = {};
	api.tasks.processing = false;
	api.tasks.timers = {};
	api.tasks.cycleTimeMS = 1000;
	
	api.tasks.queue = function(api, taskName, params){
		if(api.tasks.processing){
			var recheckTime = api.tasks.cycleTimeMS / 4;
			setTimeout(api.tasks.queue, recheckTime, api, taskName, params);
		}else{
			api.cache.data["_taskQueue"].value.push({
				taskName: taskName,
				params: params
			});
		}
	};
	
	api.tasks.run = function(api, taskName, params, next){
		if(typeof api.tasks.tasks[taskName] == "object"){
			api.log("running task: "+taskName, "yellow");
			clearTimeout(api.tasks.timers[taskName]);
			api.tasks.tasks[taskName].run(api, params, function(resp){
				var task = api.tasks.tasks[taskName];
				if(task.frequency > 0){
					api.tasks.timers[taskName] = setTimeout(api.tasks.queue, task.frequency, api, task.name);
				}
				if(typeof next == "function"){ next(resp); }
			})
		}else{
			api.log(taskName + " is not a known task", "red");
			if(typeof next == "function"){ next(false); }
		}
	};
	
	api.tasks.process = function(api){
		api.tasks.processing = true;
		clearTimeout(api.tasks.processTimer);
		api.actionCluster.cache.load(api, "_taskQueue", function(clusterResp){
			if(clusterResp == false){ // no cluster
				api.cache.load(api, "_taskQueue", function(localResp){
					if(localResp.length > 0){
						var thisTask = localResp[0];
						newQueue = localResp.splice(1);
						api.cache.save(api, "_taskQueue", newQueue, null, function(){
							api.tasks.run(api, thisTask.taskName, thisTask.params, function(){
								api.tasks.processTimer = setTimeout(api.tasks.process, api.tasks.cycleTimeMS, api);
								api.tasks.processing = false;
							})
						});
					}else{
						api.cache.save(api, "_taskQueue", localResp, null, function(){
							api.tasks.processTimer = setTimeout(api.tasks.process, api.tasks.cycleTimeMS, api);
							api.tasks.processing = false;
						});
					}
				})
			}else{ // other peers
				api.tasks.processTimer = setTimeout(api.tasks.process, api.tasks.cycleTimeMS, api);
				api.tasks.processing = false;
			}
		});
	};
		
	// init
	var validateTask = function(api, task){
		var fail = function(msg){
			api.log(msg + "; exiting.", ['red', 'bold']);
			process.exit();
		}

		if(typeof task.name != "string" && task.name.length < 1){
			fail("a task is missing `task.name`");
		}else if(typeof task.description != "string" && task.name.description < 1){
			fail("Task "+task.name+" is missing `task.description`");
		}else if(typeof task.scope != "string"){
			fail("Task "+task.name+" has no scope");
		}else if(typeof task.frequency != "number"){
			fail("Task "+task.name+" has no frequency");	
		}else if(typeof task.run != "function"){
			fail("Task "+task.name+" has no run method");
		}
	}
	
	var taskFolders = [ 
		process.cwd() + "/tasks/", 
		process.cwd() + "/node_modules/actionHero/tasks/"
	]
	
	for(var i in taskFolders){
		var folder = taskFolders[i];
		if(api.path.existsSync(folder)){
			api.fs.readdirSync(folder).forEach( function(file) {
				if (file != ".DS_Store"){
					var taskName = file.split(".")[0];
					var thisTask = require(folder + file)["task"];
					api.tasks.tasks[thisTask.name] = require(folder + file).task;
					validateTask(api, api.tasks.tasks[thisTask.name]);
					api.log("task loaded: " + taskName, "yellow");
				}
			});
		}
	}
	
	api.cache.save(api, "_taskQueue", [], null, function(){
		if(api.actionCluster.connectionsToPeers.length == 0){
			api.tasks.manager = true;
			api.log("I will be the task manager", ["yellow", "bold"]);
			api.tasks.process(api);
			// populate recurring tasks
			for(var i in api.tasks.tasks){
				var task = api.tasks.tasks[i];
				if(task.frequency > 0){
					api.tasks.timers[task.name] = setTimeout(api.tasks.queue, task.frequency, api, task.name);
				}
			}
			next();
		}else{
			api.tasks.manager = false;
			next();
		}
	});
}

/////////////////////////////////////////////////////////////////////
// exports
exports.initTasks = initTasks;