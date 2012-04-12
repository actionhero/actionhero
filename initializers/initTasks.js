////////////////////////////////////////////////////////////////////////////
// Periodic Tasks (fixed timer events)

var initTasks = function(api, next)
{
	api.tasks = {};
	api.tasks.tasks = {};
	api.tasks.queue = [];
	api.tasks.timers = {};
	api.tasks.cycleTimeMS = 500;
	api.tasks.processing = {};
	
	api.tasks.enqueue = function(api, taskName, params){
		if(typeof api.tasks.tasks[taskName] == "object"){
			var t = api.tasks.tasks[taskName];
			
			// I can run locally
			if(t.scope == "all" || api.actionCluster.master === true){
				api.tasks.queue.push({
					taskName: taskName,
					params: params
				});
			
			// The master server should run it
			}else{
				api.actionCluster.requestID++;
				var requestID = api.actionCluster.requestID;
				api.actionCluster.cache.results[requestID] = {
					requestID: requestID,
					complete: false,
					peerResponses: []
				};
				api.actionCluster.sendToAllPeers({action: "taskEnqueue", taskName: taskName, params: params, requestID: requestID});
				api.actionCluster.cache.checkForComplete(api, requestID, api.actionCluster.connectionsToPeers.length, function(resp){
					if(resp == false){
						setTimeout(api.tasks.enqueue, api.configData.actionCluster.ReConnectToLostPeersMS , api, taskName, params) // try again, wait for reconnections
						api.log("Cannot enque task with master, trying again...", "red");
					}else{
						var found = false;
						for (var i in resp){
							if(resp[i].value == true){
								found = true;
								break;
							}
						}
						if(found == false){
							setTimeout(api.tasks.enqueue, api.configData.actionCluster.ReConnectToLostPeersMS , api, taskName, params) // try again, wait for reconnections
							api.log("Cannot enque task with master, trying again...", "red");
						}
					}
				});
			}
		}else{
			api.log(taskName + " is not a known task", "red");
		}
	};
	
	api.tasks.run = function(api, taskName, params, next){
		clearTimeout(api.tasks.timers[taskName]);
		if(api.utils.hashLength(api.actionCluster.peers) == 0 || api.tasks.tasks[taskName].scope == "all"){
			api.tasks.runLocaly(api, taskName, params, next);
		}else{
			for(var i in api.actionCluster.peers){
				var sent = false;
				if(api.actionCluster.peers[i] == "connected" && api.tasks.processing[i] != "processing"){
					api.tasks.runRemote(api, taskName, params, i);
					sent = true;
					break;
				}
			}
			if(sent == false){ 
				api.tasks.enqueue(api, taskName, params);
				next(false); 
			}else{
				next(false);
			}
		}
	};
	
	api.tasks.runRemote = function(api, taskName, params, peer){
		api.tasks.processing[peer] = "processing";
		api.log("enqueing task: "+taskName+" on peer "+peer, "yellow");
		api.actionCluster.requestID++;
		var requestID = api.actionCluster.requestID;
		api.actionCluster.cache.results[requestID] = {
			requestID: requestID,
			complete: false,
			peerResponses: []
		};
		var msgObj = {
			action: "taskRun", 
			taskName: taskName, 
			params: params, 
			requestID: requestID
		};
		var parts = peer.split(":");
		api.actionCluster.sendToPeer(msgObj, parts[0], parts[1]);
		
		var checkForTaskComplete = function(api, requestID, taskName, peer){
			api.actionCluster.cache.checkForComplete(api, requestID, 1, function(resp){
				if(resp == false || resp.length == 0){
					// peer still there?
					if(api.actionCluster.peers[peer] == "connected"){
						api.log("waiting for "+respPeer +"to comple task...", "yellow");
						checkForTaskComplete(api, requestID, taskName, peer);
					}else{
						api.tasks.processing[peer] = false;
						api.tasks.enqueue(api, taskName, params);
					}
				}else{
					var content = resp.taskResp;
					var respPeer = resp[0].remotePeer.host + ":" + resp[0].remotePeer.port;
					api.log("task complete on peer "+respPeer, "yellow");
					api.tasks.processing[respPeer] = false;
					if(api.tasks.tasks[taskName].frequency > 0){
						api.tasks.timers[taskName] = setTimeout(api.tasks.enqueue, api.tasks.tasks[taskName].frequency, api, taskName);
					}
				}
			});
		}
		checkForTaskComplete(api, requestID, taskName, peer);
	}
	
	api.tasks.runLocaly = function(api, taskName, params, next){
		api.tasks.processing
		api.log("running task: "+taskName, "yellow");
		api.tasks.tasks[taskName].run(api, params, function(resp){
			if(typeof next == "function"){ next(true); }
		})
	}
	
	api.tasks.process = function(api){		
		clearTimeout(api.tasks.processTimer);
		if(api.tasks.queue.length > 0){
			var thisTask = api.tasks.queue[0];
			api.tasks.queue = api.tasks.queue.splice(1);
			api.tasks.run(api, thisTask.taskName, thisTask.params, function(run){
				if(run){
					if(api.tasks.tasks[thisTask.taskName].frequency > 0){
						api.tasks.timers[thisTask.taskName] = setTimeout(api.tasks.enqueue, api.tasks.tasks[thisTask.taskName].frequency, api, thisTask.taskName);
					}
				}
				api.tasks.processTimer = setTimeout(api.tasks.process, api.tasks.cycleTimeMS, api);
			});
		}else{
			api.tasks.processTimer = setTimeout(api.tasks.process, api.tasks.cycleTimeMS, api);
		}
	};
	
	api.tasks.startPeriodicTasks = function(api, next){
		for(var i in api.tasks.tasks){
			var task = api.tasks.tasks[i];
			if(task.frequency > 0 && ( task.scope == "all" || api.actionCluster.master === true)){
				if(api.tasks.timers[task.name] == null){
					api.tasks.timers[task.name] = setTimeout(api.tasks.enqueue, task.frequency, api, task.name);
				}
			}
		}
		next();
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
		if(api.fs.existsSync(folder)){
			api.fs.readdirSync(folder).forEach( function(file) {
				if (file != ".DS_Store"){
					var taskName = file.split(".")[0];
					if(require.cache[folder + file] != null){
						delete require.cache[folder + file];
					}
					var thisTask = require(folder + file)["task"];
					api.tasks.tasks[thisTask.name] = require(folder + file).task;
					validateTask(api, api.tasks.tasks[thisTask.name]);
					api.log("task loaded: " + taskName, "yellow");
				}
			});
		}
	}
	
	api.tasks.startPeriodicTasks(api, function(){
		api.tasks.process(api);
		next();	
	})
}

/////////////////////////////////////////////////////////////////////
// exports
exports.initTasks = initTasks;