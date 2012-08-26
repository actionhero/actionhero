// tasks!

var initTasks = function(api, next)
{
	api.tasks = {};
	api.tasks.tasks = {};
	api.tasks.timers = {};
	api.tasks.cycleTimeMS = 100;
	api.tasks.reloadPeriodicsTime = 1000 * 60 * 60; // once an hour
	api.tasks.processTimers = [];

	if(api.redis.enable === true){
		api.tasks.redisQueue = "actionHero::tasks";
		api.tasks.redisQueueLocal = "actionHero::tasks::" + api.id;
		api.tasks.redisProcessingQueue = "actionHero::tasksClaimed";
	}else{
		api.tasks.queue = [];
	}

	// catch for old AH config files
	// 0 is allowed, but null is not
	if(api.configData.general.workers == null){
		api.configData.general.workers = 1;
	}
	
	api.tasks.enqueue = function(api, taskName, runAtTime, params, next){
		if(typeof api.tasks.tasks[taskName] === "object"){
			var msg = {
				taskName: taskName,
				runAtTime: runAtTime,
				params: params
			};
			msg = JSON.stringify(msg);
			if(api.redis.enable === true){
				var toEnqueue = true;
				//
				if(api.tasks.tasks[taskName].scope == "all"){
					if(api.tasks.tasks[taskName].frequency > 0){
						api.tasks.queueLength(api, api.tasks.redisQueueLocal, function(length){
							api.redis.client.lrange(api.tasks.redisQueueLocal, 0, length, function(err, enquedTasks){
								for(var i in enquedTasks){
									var t = JSON.parse(enquedTasks[i]);
									if(t.taskName == taskName){
										toEnqueue = false;
										api.log(" > not enqueing "+taskName+" (periodic) as it is already in the local queue", "yellow");
										break;
									}
								}
								if(toEnqueue){
									api.redis.client.rpush(api.tasks.redisQueueLocal, msg, function(){
										if(typeof next == "function"){ next(true); }
									});
								}else{
									if(typeof next == "function"){ next(false); }
								}
							});
						});
					}else{
						api.redis.client.rpush(api.tasks.redisQueueLocal, msg, function(){
							if(typeof next == "function"){ next(true); }
						});
					}
				}else{
					if(api.tasks.tasks[taskName].frequency > 0){
						api.tasks.queueLength(api, api.tasks.redisQueue, function(length){
							api.redis.client.lrange(api.tasks.redisQueue, 0, length, function(err, enquedTasks){
								for(var i in enquedTasks){
									var t = JSON.parse(enquedTasks[i]);
									if(t.taskName == taskName){
										toEnqueue = false;
										api.log(" > not enqueing "+taskName+" (periodic) as it is already in the global queue", "yellow");
										break;
									}
								}
								if(toEnqueue){
									api.redis.client.hget(api.tasks.redisProcessingQueue, taskName, function (err, taskProcessing){
										if(taskProcessing != null){
											api.log(" > not enqueing "+taskName+" (periodic) as it is already being worked on", "yellow")
											if(typeof next == "function"){ next(false); }
										}else{
											api.redis.client.rpush(api.tasks.redisQueue, msg, function(){
												if(typeof next == "function"){ next(true); }
											});
										}
									});							
								}else{
									if(typeof next == "function"){ next(true); }
								}
							});
						});
					}else{
						api.redis.client.rpush(api.tasks.redisQueue, msg, function(){ });
						if(typeof next == "function"){ next(true); }
					}
				}
			}else{
				var toEnqueue = true;
				if(api.tasks.tasks[taskName].frequency > 0){
					for(var i in api.tasks.queue){
						var t = JSON.parse(api.tasks.queue[i]);
						if(t.taskName == taskName){
							toEnqueue = false;
							api.log(" > not enqueing "+taskName+" (periodic) as it is already in the queue", "yellow");
							break;
						}
					}
				}
				if(toEnqueue){
					api.tasks.queue.push(msg);
					if(typeof next == "function"){ next(true); }
				}else{
					if(typeof next == "function"){ next(false); }
				}
			}
		}else{
			api.log(taskName + " is not a known task", "red");
			if(typeof next == "function"){ next(false); }
		}
	};

	api.tasks.queueLength = function(api, queue, next){
		if(api.redis.enable === true){
			api.redis.client.llen(queue, function(err, length){
				next(length);
			})
		}else{
			next(api.tasks.queue.length);
		}
	}

	api.tasks.getNextTask = function(api, next){
		var now = new Date().getTime();
		if(api.redis.enable === true){
			// get a global task
			var now = new Date().getTime();
			api.redis.client.lpop(api.tasks.redisQueue, function(err, task){
				if(task != null){
					parsedTask = JSON.parse(task);
					if(parsedTask.runAtTime == null || now > parsedTask.runAtTime){
						var data = {
							taskName: parsedTask.taskName,
							params: parsedTask.params,
							server: api.id
						}
						api.redis.client.hset(api.tasks.redisProcessingQueue, parsedTask.taskName, JSON.stringify(data), function(){
							next(parsedTask);
							return
						});
					}else{
						api.tasks.enqueue(api, parsedTask.taskName, parsedTask.runAtTime, parsedTask.params, function(){
							next(null);
						});
					}
				}
				if(task == null){
					// get a local task
					api.redis.client.lpop(api.tasks.redisQueueLocal, function(err, task){
						if(task != null){
							parsedTask = JSON.parse(task);
							if(parsedTask.runAtTime == null || now > parsedTask.runAtTime){
								next(parsedTask);
							}else{
								api.tasks.enqueue(api, parsedTask.taskName, parsedTask.runAtTime, parsedTask.params, function(){
									next(null);
								});
							}
						}else{
							
						}
					});
				}
			});
		}else{
			if(api.tasks.queue.length > 0){
				var task = api.tasks.queue.shift();
				var parsedTask = JSON.parse(task);
				if(parsedTask.runAtTime == null || now > parsedTask.runAtTime){
					next(parsedTask);
				}else{
					api.tasks.enqueue(api, parsedTask.taskName, parsedTask.runAtTime, parsedTask.params, function(){
						next(null);
					});
				}
			}else{
				next(null);
			}
		}
	}
	
	api.tasks.run = function(api, taskName, params, next){
		api.tasks.tasks[taskName].run(api, params, function(resp){
			if(typeof next == "function"){ next(true); }
		})
	};
	
	api.tasks.process = function(api, worker_id){	
		clearTimeout(api.tasks.processTimers[worker_id]);
		api.tasks.getNextTask(api, function(task){
			if(task == null){
				api.tasks.processTimers[worker_id] = setTimeout(api.tasks.process, api.tasks.cycleTimeMS, api, worker_id);
			}else{
				api.tasks.run(api, task.taskName, task.params, function(run){
					if(run){
						api.log("[timer "+worker_id+"] ran task: "+task.taskName, "yellow");
					}else{
						api.log("[timer "+worker_id+"] task failed to run: "+JSON.stringify(task), "red")
					}
					if(api.redis.enable === true){
						// remove the task from the processing queue (redis only)
						api.redis.client.hdel(api.tasks.redisProcessingQueue, task.taskName, function(){
							if(api.tasks.tasks[task.taskName].frequency > 0){
								api.tasks.enqueuePeriodicTask(api, api.tasks.tasks[task.taskName], function(){
									api.tasks.processTimers[worker_id] = setTimeout(api.tasks.process, api.tasks.cycleTimeMS, api, worker_id);
								});
							}else{
								api.tasks.processTimers[worker_id] = setTimeout(api.tasks.process, api.tasks.cycleTimeMS, api, worker_id);
							}
						});
					}else{
						if(api.tasks.tasks[task.taskName].frequency > 0){
							api.tasks.enqueuePeriodicTask(api, api.tasks.tasks[task.taskName], function(){
								api.tasks.processTimers[worker_id] = setTimeout(api.tasks.process, api.tasks.cycleTimeMS, api, worker_id);
							});
						}else{
							api.tasks.processTimers[worker_id] = setTimeout(api.tasks.process, api.tasks.cycleTimeMS, api, worker_id);
						}
					}
				});
			}
		});
	};

	api.tasks.enqueuePeriodicTask = function(api, task, next){
		if(task.frequency > 0){
			var runAtTime = new Date().getTime() + task.frequency;
			api.tasks.enqueue(api, task.name, runAtTime, null, function(){
				if(typeof next == "function"){ next(); }
			});
		}
	}
	
	api.tasks.startPeriodicTasks = function(api, next){
		api.log("setting up periodic tasks...", "yellow")
		clearTimeout(api.tasks.periodicTaskReloader);
		for(var i in api.tasks.tasks){
			var task = api.tasks.tasks[i];
			if(task.frequency > 0){
				api.tasks.enqueuePeriodicTask(api, task);
			}
		}
		api.tasks.periodicTaskReloader = setTimeout(api.tasks.startPeriodicTasks, api.tasks.reloadPeriodicsTime, api);
		if(typeof next == "function"){ next(); }
	}

	api.tasks.clearStuckClaimedTasks = function(api, next){
		if(api.redis.enable === true){
			function done(started){
				started--;
				if(started == 0){ next(); }
				else{ return started }
			}

			var started = 0;
			if(api.tasks.tasks.length == 0){
				started = done(started)
			}else{
				for(var i in api.tasks.tasks){
					var task = api.tasks.tasks[i];
					started++;
					if(task.frequency > 0 && task.scope == "any"){
						api.redis.client.hget(api.tasks.redisProcessingQueue, task.name, function (err, taskProcessing){
							if(taskProcessing){
								var redisTask = JSON.parse(taskProcessing);
								if(redisTask.server == api.id){
									api.log(" > clearing a stuck task `"+redisTask.taskName+"` which was previously registered by this server", ["yellow", "bold"]);
									api.redis.client.hdel(api.tasks.redisProcessingQueue, redisTask.taskName, function(){
										started = done(started)
									});
								}else{
									started = done(started)
								}
							}else{
								started = done(started)
							}
						});
					}else{
						started = done(started)
					}
				}
			}
		}else{
			next();
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
	
	function loadFolder(path){
		api.fs.readdirSync(path).forEach( function(file) {
			if(path[path.length - 1] != "/"){ path += "/"; } 
			var fullfFilePath = path + file;
			if (file[0] != "."){
				stats = api.fs.statSync(fullfFilePath);
				if(stats.isDirectory()){
					loadFolder(fullfFilePath);
				}else if(stats.isSymbolicLink()){
					var realPath = readlinkSync(fullfFilePath);
					loadFolder(realPath);
				}else if(stats.isFile()){
					var taskName = file.split(".")[0];
					api.tasks.tasks[taskName] = require(path + file).task;
					validateTask(api, api.tasks.tasks[taskName]);
					api.log("task loaded: " + taskName + ", " + fullfFilePath, "yellow");
				}else{
					api.log(file+" is a type of file I cannot read", "red")
				}
			}
		});
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
