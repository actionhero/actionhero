////////////////////////////////////////////////////////////////////////////
// Periodic Tasks (fixed timer events)

var initTasks = function(api, next)
{
	api.tasks = {};
	api.tasks.tasks = {};
	api.tasks.queue = [];
	api.tasks.timers = {};
	api.tasks.cycleTimeMS = 1000;
	
	api.tasks.enqueue = function(api, taskName, params){
		api.tasks.queue.push({
			taskName: taskName,
			params: params
		});
	};
	
	api.tasks.run = function(api, taskName, params, next){
		if(typeof api.tasks.tasks[taskName] == "object"){
			api.log("running task: "+taskName, "yellow");
			clearTimeout(api.tasks.timers[taskName]);
			api.tasks.tasks[taskName].run(api, params, function(resp){
				var task = api.tasks.tasks[taskName];
				if(task.frequency > 0){
					api.tasks.timers[taskName] = setTimeout(api.tasks.enqueue, task.frequency, api, task.name);
				}
				if(typeof next == "function"){ next(resp); }
			})
		}else{
			api.log(taskName + " is not a known task", "red");
			if(typeof next == "function"){ next(false); }
		}
	};
	
	api.tasks.process = function(api){		
		clearTimeout(api.tasks.processTimer);
		api.tasks.startPeriodicTasks(api, function(){
			if(api.tasks.queue.length > 0){
				var thisTask = api.tasks.queue[0];
				api.tasks.queue = api.tasks.queue.splice(1);
				api.tasks.run(api, thisTask.taskName, thisTask.params, function(){
					api.tasks.processTimer = setTimeout(api.tasks.process, api.tasks.cycleTimeMS, api);
				});
			}else{
				api.tasks.processTimer = setTimeout(api.tasks.process, api.tasks.cycleTimeMS, api);
			}
		});
	};
	
	api.tasks.startPeriodicTasks = function(api, next){
		var _periodicTasks = [];
		if(api.actionCluster.connectionsToPeers.length < 2){
			for(var i in api.tasks.tasks){
				var task = api.tasks.tasks[i];
				if(task.frequency > 0){ // all scopes ok for single node
					if(api.tasks.timers[task.name] == null){
						api.tasks.timers[task.name] = setTimeout(api.tasks.enqueue, task.frequency, api, task.name);
					}
					_periodicTasks.push(task.name);
				}
			}
			api.cache.save(api, "_periodicTasks", _periodicTasks, null, function(){
				next();
			});
		}else{
			api.actionCluster.cache.load(api, "_periodicTasks", function(clusterResp){
				var otherPeerTasks = {}
				for(var i in clusterResp){
					for(var j in clusterResp[i]['value']){
						otherPeerTasks[clusterResp[i]['value'][j]] = true;
					}
				}
				for(var i in api.tasks.tasks){
					var task = api.tasks.tasks[i];
					if(task.frequency > 0 && ( task.scope == "all" || otherPeerTasks[task.name] == null)){
						console.log("ADDING: "+task.name);
						if(api.tasks.timers[task.name] == null){
							api.tasks.timers[task.name] = setTimeout(api.tasks.enqueue, task.frequency, api, task.name);
						}
						_periodicTasks.push(task.name);
					}else{
						console.log("KILLING: "+task.name);
						clearTimeout(api.tasks.timers[task.name]);
					}
				}
				api.cache.save(api, "_periodicTasks", _periodicTasks, null, function(){
					next();
				});
			});
		}
	}
		
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
	
	api.cache.save(api, "_periodicTasks", [], null, function(){
		api.tasks.process(api);
		next();
	});
}

/////////////////////////////////////////////////////////////////////
// exports
exports.initTasks = initTasks;