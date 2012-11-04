// tasks!

var initTasks = function(api, next)
{
	api.tasks = {};
	api.tasks.tasks = {};
	api.tasks.timers = {};
	api.tasks.cycleTimeMS = 100;
	api.tasks.reloadPeriodicsTime = 1000 * 60 * 10; // every 10 minutes
	api.tasks.processTimers = [];
	api.tasks.currentTasks = {};
	api.tasks.enqueLock = false;

	if(api.redis.enable === true){
		api.tasks.redisQueue = "actionHero:tasks";
		api.tasks.redisQueueLocal = "actionHero:tasks::" + api.id;
		api.tasks.redisProcessingQueue = "actionHero:tasksClaimed";
	}else{
		api.tasks.queue = [];
	}

	// catch for old AH config files
	// 0 is allowed, but null is not
	if(api.configData.general.workers == null){
		api.configData.general.workers = 1;
	}
	
	api.tasks.enqueue = function(api, taskName, runAtTime, params, next, toAnnounce){
		if(toAnnounce == null){ toAnnounce = true; }
		if(typeof api.tasks.tasks[taskName] != "object"){
			api.log(taskName + " is not a known task", "red");
			if(typeof next == "function"){ next(new Error("not a known task"), null); }
		}else if(api.tasks.enqueLock == true){
				setTimeout(function(){
					api.tasks.enqueue(api, taskName, runAtTime, params, next, toAnnounce);
				}, api.tasks.cycleTimeMS / 2);
		}else{
			api.tasks.enqueLock = true;
			var toEnqueue = false;
			var found = false;
			var msg = JSON.stringify({ taskName: taskName, runAtTime: runAtTime, params: params });
			api.tasks.inspect(api, function(err, enquedTasks){
				if(api.tasks.tasks[taskName].frequency > 0 && api.tasks.tasks[taskName].scope == "all"){
					var queue = api.tasks.redisQueueLocal;
					for(var i in enquedTasks){
						if(enquedTasks[i].taskName == taskName && enquedTasks[i].queue == 'local'){
							api.log(" > not enqueing "+taskName+" (periodic) as it is already in the local queue", "yellow");
							found = true;
							break;
						}
						if(enquedTasks[i].taskName == taskName && enquedTasks[i].queue == 'processing'){
							api.log(" > not enqueing "+taskName+" (periodic) as it is already being worked on by " + enquedTasks[i].server, "yellow");
							found = true;
							break;
						}
					}
					if(found == false){ toEnqueue = true; }
				}else if(api.tasks.tasks[taskName].frequency > 0 && api.tasks.tasks[taskName].scope == "any"){
					var queue = api.tasks.redisQueue;
					for(var i in enquedTasks){
						if(enquedTasks[i].taskName == taskName && enquedTasks[i].queue == 'global'){
							api.log(" > not enqueing "+taskName+" (periodic) as it is already in the global queue", "yellow");
							found = true;
							break;
						}
						if(enquedTasks[i].taskName == taskName && enquedTasks[i].queue == 'processing'){
							api.log(" > not enqueing "+taskName+" (periodic) as it is already being worked on by " + enquedTasks[i].server, "yellow");
							found = true;
							break;
						}
					}
					if(found == false){ toEnqueue = true; }
				}else if(api.tasks.tasks[taskName].frequency == 0 && api.tasks.tasks[taskName].scope == "all"){
					var queue = api.tasks.redisQueueLocal;
					api.tasks.enqueForOtherPeers(api, msg); // this can be done async
					toEnqueue = true;
				}else if(api.tasks.tasks[taskName].frequency == 0 && api.tasks.tasks[taskName].scope == "any"){
					var queue = api.tasks.redisQueue;
					toEnqueue = true;
				}
				//
				if(toEnqueue){
					if(toAnnounce){ api.log(" > enqueued task: "+taskName, "yellow"); }
					if(api.redis.enable === true){
						api.redis.client.rpush(queue, msg, function(err){
							api.tasks.enqueLock = false;
							if(typeof next == "function"){ next(err, true); }
						});
					}else{
						process.nextTick(function(){
							api.tasks.queue.push(msg);
							api.tasks.enqueLock = false;
							if(typeof next == "function"){ next(null, true); }
						});
					}
				}else{
					process.nextTick(function(){
						api.tasks.enqueLock = false;
						if(typeof next == "function"){ next(null, false); }
					});
				}
			});
		}
	}

	api.tasks.enqueForOtherPeers = function(api, msg, next){
		if(api.redis.enable === true){
			api.redis.client.lrange("actionHero:peers",0,-1,function(err,peers){
				var started = 0;
				peers.forEach(function(peer){
					if(peer != api.id){
						started++;
						var queue = "actionHero:tasks::" + peer;
						api.redis.client.rpush(queue, msg, function(err){
							started--;
							if(started == 0 && typeof next == "function"){ next(null, null); }
						});
					}
				});
				if(started == 0 && typeof next == "function"){ next(null, null); }
			});
		}else{
			if(typeof next == "function"){ next(null, null); }
		}
	}

	api.tasks.inspect = function(api, next){
		tasks = [];
		for(var i in api.tasks.currentTasks){
			var parsedTask = JSON.parse(api.tasks.currentTasks[i]);
			parsedTask.queue = "processing";
			parsedTask.server = "local worker " + i,
			tasks.push(parsedTask);
		}
		if(api.redis.enable === true){
			api.redis.client.lrange(api.tasks.redisQueue, 0, -1, function(err, globalTasks){
				api.redis.client.lrange(api.tasks.redisQueueLocal, 0, -1, function(err, localTasks){
					api.redis.client.hgetall(api.tasks.redisProcessingQueue, function(err, processingTasks){
						for(var i in globalTasks){
							var parsedTask = JSON.parse(globalTasks[i]);
							parsedTask.queue = "global";
							tasks.push(parsedTask);
						}
						for(var i in localTasks){
							var parsedTask = JSON.parse(localTasks[i]);
							parsedTask.queue = "local";
							tasks.push(parsedTask);
						}
						for(var i in processingTasks){
							var data = JSON.parse(processingTasks[i])
							var parsedTask = {
								queue: "processing",
								taskName: data.taskName,
								server: data.server,
								params: data.params
							}
							tasks.push(parsedTask);
						}
						next(null, tasks);
					});
				});
			});
		}else{
			for(var i in api.tasks.queue){
				var parsedTask = JSON.parse(api.tasks.queue[i]);
				var localParsedTask = api.utils.objClone(parsedTask);
				var globalParsedTask = api.utils.objClone(parsedTask);
				localParsedTask.queue = "global";
				globalParsedTask.queue = "local";
				tasks.push(localParsedTask);
				tasks.push(globalParsedTask);
			}
			next(null, tasks);
		}
	}

	api.tasks.queueLength = function(api, queue, next){
		if(api.redis.enable === true){
			api.redis.client.llen(queue, function(err, length){
				next(length);
			})
		}else{
			next(api.tasks.queue.length);
		}
	}

	api.tasks.getNextTask = function(api, next, queue){
		var now = new Date().getTime();
		if(api.redis.enable === true){
			if(queue == null){ queue = api.tasks.redisQueue; }
			api.redis.client.lpop(queue, function(err, task){
				if(task != null){
					parsedTask = JSON.parse(task);
					if(parsedTask.runAtTime == null || now > parsedTask.runAtTime){
						var data = {
							taskName: parsedTask.taskName,
							params: parsedTask.params,
							server: api.id,
							startedAt: new Date().getTime()
						}
						if(queue == api.tasks.redisQueue){
							// only mark global tasks as locked to this server
							api.redis.client.hset(api.tasks.redisProcessingQueue, parsedTask.taskName, JSON.stringify(data), function(){
								next(null, parsedTask);
							});
						}else{
							next(null, parsedTask);
						}
					}else{
						api.tasks.enqueue(api, parsedTask.taskName, parsedTask.runAtTime, parsedTask.params, function(err, enqueued){
							if(queue == api.tasks.redisQueue){
								// try a local task
								api.tasks.getNextTask(api, next, api.tasks.redisQueueLocal);
							}else{
								next(null, null);
							}
						}, false);
					}
				}else{
					if(queue == api.tasks.redisQueue){
						// try a local task
						api.tasks.getNextTask(api, next, api.tasks.redisQueueLocal);
					}else{
						next(null, null);
					}
				}
			});
		}else{
			if(api.tasks.queue.length > 0){
				var task = api.tasks.queue.shift();
				var parsedTask = JSON.parse(task);
				if(parsedTask.runAtTime == null || now > parsedTask.runAtTime){
					next(null, parsedTask);
				}else{
					api.tasks.enqueue(api, parsedTask.taskName, parsedTask.runAtTime, parsedTask.params, function(err, enqueued){
						next(null, null);
					}, false);
				}
			}else{
				next(null, null);
			}
		}
	};
	
	api.tasks.run = function(api, taskName, params, next){
		if(api.domain != null){
			var taskDomain = api.domain.create();
			taskDomain.on("error", function(err){
				api.exceptionHandlers.task(taskDomain, err, api.tasks.tasks[taskName], next);
			});
			taskDomain.run(function(){
				api.tasks.tasks[taskName].run(api, params, function(data, cont){
					// taskDomain.dispose();
					if(cont == null){cont = true;}
					if(typeof next == "function"){ next(cont); }
				});
			})
		}else{
			api.tasks.tasks[taskName].run(api, params, function(data, cont){
				if(cont == null){cont = true;}
				if(typeof next == "function"){ next(cont); }
			});
		}
	};
	
	api.tasks.process = function(api, worker_id){	
		clearTimeout(api.tasks.processTimers[worker_id]);
		if(api.tasks.enqueLock == true){
			api.tasks.processTimers[worker_id] = setTimeout(api.tasks.process, api.tasks.cycleTimeMS, api, worker_id);
		}else{
			api.tasks.getNextTask(api, function(err, task){
				if(task == null){
					api.tasks.processTimers[worker_id] = setTimeout(api.tasks.process, api.tasks.cycleTimeMS, api, worker_id);
				}else{
					api.tasks.currentTasks[worker_id] = JSON.stringify(task);
					api.tasks.run(api, task.taskName, task.params, function(run){
						if(run){
							api.log("[timer "+worker_id+"] ran task: "+task.taskName, "yellow");
						}else{
							api.log("[timer "+worker_id+"] task failed to run: "+JSON.stringify(task), "red")
						}
						delete api.tasks.currentTasks[worker_id];
						if(api.redis.enable === true){
							// remove the task from the processing queue (redis only)
							api.redis.client.hdel(api.tasks.redisProcessingQueue, task.taskName, function(){
								if(api.tasks.tasks[task.taskName].frequency > 0){
									api.tasks.enqueuePeriodicTask(api, api.tasks.tasks[task.taskName], function(){
										api.tasks.processTimers[worker_id] = setTimeout(api.tasks.process, api.tasks.cycleTimeMS, api, worker_id);
									}, false);
								}else{
									api.tasks.processTimers[worker_id] = setTimeout(api.tasks.process, api.tasks.cycleTimeMS, api, worker_id);
								}
							});
						}else{
							if(api.tasks.tasks[task.taskName].frequency > 0){
								api.tasks.enqueuePeriodicTask(api, api.tasks.tasks[task.taskName], function(){
									api.tasks.processTimers[worker_id] = setTimeout(api.tasks.process, api.tasks.cycleTimeMS, api, worker_id);
								}, false);
							}else{
								api.tasks.processTimers[worker_id] = setTimeout(api.tasks.process, api.tasks.cycleTimeMS, api, worker_id);
							}
						}
					});
				}
			});
		}
	};

	api.tasks.enqueuePeriodicTask = function(api, task, next, toAnnounce){
		if(toAnnounce == null){ toAnnounce = true; }
		if(task.frequency > 0){
			var runAtTime = new Date().getTime() + task.frequency;
			api.tasks.enqueue(api, task.name, runAtTime, null, function(err, enqueued){
				if(typeof next == "function"){ next(); }
			}, toAnnounce);
		}
	}
	
	api.tasks.startPeriodicTasks = function(api, next){
		api.log("setting up periodic tasks...", "yellow")
		clearTimeout(api.tasks.periodicTaskReloader);
		var started = 0;
		for(var i in api.tasks.tasks){
			var task = api.tasks.tasks[i];
			if(task.frequency > 0){
				started++;
				api.tasks.enqueuePeriodicTask(api, task, function(){
					started--;
					if(started == 0){ 
						api.tasks.periodicTaskReloader = setTimeout(api.tasks.startPeriodicTasks, api.tasks.reloadPeriodicsTime, api);
						if(typeof next == "function"){ next(); }; 
					}
				});
			}
		}
		if(started == 0){ 
			api.tasks.periodicTaskReloader = setTimeout(api.tasks.startPeriodicTasks, api.tasks.reloadPeriodicsTime, api);
			if(typeof next == "function"){ next(); }; 
		}
	}

	api.tasks.clearStuckClaimedTasks = function(api, next){
		api.tasks.inspect(api, function(err, enqueuedTasks){
			var started = 0;
			for(var i in enqueuedTasks){
				if(enqueuedTasks[i].queue == 'processing' && enqueuedTasks[i].server == api.id){
					api.log(" > clearing a stuck task `"+enqueuedTasks[i].taskName+"` which was previously registered by this server", ["yellow", "bold"]);
					started++;
					api.redis.client.hdel(api.tasks.redisProcessingQueue, enqueuedTasks[i].taskName, function(err){
						started--;
						if(started == 0){ next(); }
					});
				}
			}
			if(started == 0){ next(); }
		});
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
	
	var loadFolder = function(path){
		api.fs.readdirSync(path).forEach( function(file) {
			if(path[path.length - 1] != "/"){ path += "/"; } 
			var fullfFilePath = path + file;
			if (file[0] != "."){
				var stats = api.fs.statSync(fullfFilePath);
				if(stats.isDirectory()){
					loadFolder(fullfFilePath);
				}else if(stats.isSymbolicLink()){
					var realPath = readlinkSync(fullfFilePath);
					loadFolder(realPath);
				}else if(stats.isFile()){
					taskLoader(api, fullfFilePath)
				}else{
					api.log(file+" is a type of file I cannot read", "red")
				}
			}
		});
	}

	var taskLoader = function(api, fullfFilePath, reload){
		if(reload == null){ reload = false; }
		var parts = fullfFilePath.split("/");
		var file = parts[(parts.length - 1)];
		var taskName = file.split(".")[0];
		var loadMessage = "task loaded: " + taskName + ", " + fullfFilePath;
		if(reload){
			loadMessage = "task (re)loaded: " + taskName + ", " + fullfFilePath;
		}else{
			if(api.configData.general.developmentMode == true){
				api.watchedFiles.push(fullfFilePath);
				(function() {
					api.fs.watchFile(fullfFilePath, {interval:1000}, function(curr, prev){
						if(curr.mtime > prev.mtime){
							process.nextTick(function(){
								if(api.fs.readFileSync(fullfFilePath).length > 0){
									delete require.cache[fullfFilePath];
									delete api.tasks.tasks[taskName];
									taskLoader(api, fullfFilePath, true);
								}
							});
						}
					});
				})();
			}
		}
		try{
			api.tasks.tasks[taskName] = require(fullfFilePath).task;
			validateTask(api, api.tasks.tasks[taskName]);
			api.log(loadMessage, "yellow")
		}catch(err){
			api.exceptionHandlers.loader(fullfFilePath, err);
		}
	}

	var taskFolders = [ 
		process.cwd() + "/tasks/", 
	]

	for(var i in taskFolders){
		loadFolder(taskFolders[i]);
	}

	// I should be started in api.js, after everything has loaded
	api.tasks.startTaskProcessing = function(api, next){
		api.tasks.clearStuckClaimedTasks(api, function(){
			api.tasks.startPeriodicTasks(api, function(){
				var i = 0;
				api.log("starting "+api.configData.general.workers+" task timers", "yellow")
				while(i < api.configData.general.workers){
					api.tasks.process(api, i);
					i++;
				}
				next();	
			});
		});
	}
	
	next();
}

/////////////////////////////////////////////////////////////////////
// exports
exports.initTasks = initTasks;
