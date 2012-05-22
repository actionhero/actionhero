// tasks!

var initTasks = function(api, next)
{
	api.tasks = {};
	api.tasks.tasks = {};
	api.tasks.timers = {};
	api.tasks.cycleTimeMS = 50;
	api.tasks.reloadPeriodicsTime = 60000;
	api.tasks.processTimer = null;

	if(api.redis.enable === true){
		api.tasks.redisQueue = "actionHero::tasks";
		api.tasks.redisQueueLocal = "actionHero::tasks::" + api.id;
		api.tasks.redisProcessingQueue = "actionHero::tasksClaimed";
	}else{
		api.tasks.queue = [];
	}
	
	api.tasks.enqueue = function(api, taskName, params){
		if(typeof api.tasks.tasks[taskName] === "object"){
			var msg = {
				taskName: taskName,
				params: params
			};
			msg = JSON.stringify(msg);
			if(api.redis.enable === true){
				var toEnqueue = true;
				if(api.tasks.tasks[taskName].scope == "all"){
					api.redis.client.rpush(api.tasks.redisQueueLocal, msg, function(){ });
				}else{
					api.tasks.queueLength(api, function(length){
						api.redis.client.lrange(api.tasks.redisQueue, 0, length, function(err, enquedTasks){
							for(var i in enquedTasks){
								var t = JSON.parse(enquedTasks);
								if(t.taskName == taskName){
									toEnqueue = false;
									api.log("not enqueing "+taskName+" (periodic) as it is already in the queue", "yellow");
									break;
								}
							}
							if(toEnqueue){
								api.redis.client.hget(api.tasks.redisProcessingQueue, taskName, function (err, taskProcessing){
									if(taskProcessing != null){
										var data = JSON.parse(taskProcessing);
										var rawTask = api.tasks.tasks[data.taskName];
										if(rawTask.frequency > 0){
											toEnqueue = false;
											api.log("not enqueing "+taskName+" (periodic) as it is already being worked on", "yellow")
										}else{
											api.redis.client.rpush(api.tasks.redisQueue, msg, function(){ });
										}
									}else{
										api.redis.client.rpush(api.tasks.redisQueue, msg, function(){ });
									}
								});							
							}
						});
					});
				}
			}else{
				api.tasks.queue.push(msg);
			}
		}else{
			api.log(taskName + " is not a known task", "red");
		}
	};

	api.tasks.queueLength = function(api, next){
		if(api.redis.enable === true){
			api.redis.client.llen(api.tasks.redisQueue, function(err, length){
				next(length);
			})
		}else{
			next(api.tasks.queue.length);
		}
	}

	api.tasks.getNextTask = function(api, next){
		if(api.redis.enable === true){
			// get a global task
			api.redis.client.lpop(api.tasks.redisQueue, function(err, task){
				if(task != null){
					task = JSON.parse(task);
					var data = {
						taskName: task.taskName,
						params: task.params,
						server: api.id
					}
					api.redis.client.hset(api.tasks.redisProcessingQueue, task.taskName, JSON.stringify(data), function(){
						next(task);
					});
				}else{
					// get a local task
					api.redis.client.lpop(api.tasks.redisQueueLocal, function(err, task){
						if(task != null){
							task = JSON.parse(task);
							next(task);
						}else{
							next(null);
						}
					});
				}
			});
		}else{
			if(api.tasks.queue.length > 0){
				var task = api.tasks.queue.pop();
				next(JSON.parse(task));
			}else{
				next(null);
			}
		}
	}
	
	api.tasks.run = function(api, taskName, params, next){
		clearTimeout(api.tasks.timers[taskName]);
		api.log("running task: "+taskName, "yellow");
		api.tasks.tasks[taskName].run(api, params, function(resp){
			if(typeof next == "function"){ next(true); }
		})
	};
	
	api.tasks.process = function(api){		
		clearTimeout(api.tasks.processTimer);
		api.tasks.getNextTask(api, function(task){
			if(task == null){
				api.tasks.processTimer = setTimeout(api.tasks.process, api.tasks.cycleTimeMS, api);
			}else{
				api.tasks.run(api, task.taskName, task.params, function(run){
					if(run){
						//
					}else{
						api.log("task failed to run: "+JSON.stringify(task), "red")
					}
					if(api.redis.enable === true){
						// remove the task from the processing queue
						api.redis.client.hdel(api.tasks.redisProcessingQueue, task.taskName, function(){ });
					}
					api.tasks.enqueuePeriodicTask(api, api.tasks.tasks[task.taskName])
					api.tasks.processTimer = setTimeout(api.tasks.process, api.tasks.cycleTimeMS, api);
				});
			}
		})
	};

	api.tasks.enqueuePeriodicTask = function(api, task){
		if(task.frequency > 0){
			if(api.tasks.timers[task.name] == null || api.tasks.timers[task.name].ontimeout == null){
				api.tasks.timers[task.name] = setTimeout(function(api, task){
					clearTimeout(api.tasks.timers[task.name]);
					api.tasks.enqueue(api, task.name, null);
				}, task.frequency, api, task);
			}
		}
	}
	
	api.tasks.startPeriodicTasks = function(api, next){
		clearTimeout(api.tasks.periodicTaskReloader);
		for(var i in api.tasks.tasks){
			var task = api.tasks.tasks[i];
			if(task.frequency > 0){
				api.tasks.enqueuePeriodicTask(api, task)
			}
		}
		api.tasks.periodicTaskReloader = setTimeout(api.tasks.startPeriodicTasks, api.tasks.reloadPeriodicsTime, api) // check to be sure that all the period tasks are still present
		if(typeof next == "function"){ next(); }
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