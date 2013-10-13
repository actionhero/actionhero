var fs = require('fs');

var tasks = function(api, next){
  
  //////////////////////////
  // The tasks themselves //
  //////////////////////////

  api.tasks = {};
  api.tasks.tasks = {};
  api.tasks.taskProcessors = [];
  api.tasks.cycleTimeMS = 200;

  api.tasks.queues = {
    globalQueue: 'actionHero:tasks:global',
    delayedQueuePrefix: 'actionHero:tasks:delayed',
    localQueue: 'actionHero:tasks:' + api.id.replace(/:/g,'-'),
    data: 'actionHero:tasks:data', // actually a hash
    workerStatus: 'actionHero:tasks:workerStatus', // actually a hash
    enqueuedPeriodicTasks: 'actionHero:tasks:enqueuedPeriodicTasks'
  }

  api.tasks._start = function(api, next){
    api.tasks.clearWorkerStatus(function(){
      api.tasks.seedPeriodicTasks(function(){
        next();
      });
    });
  }

  api.tasks.getWorkerStatuses = function(callback){
    api.redis.client.hgetall(api.tasks.queues.workerStatus, function(err, workerStatuses){
      callback(err, workerStatuses);
    });
  }

  api.tasks.clearWorkerStatus = function(callback){
    api.redis.client.hgetall(api.tasks.queues.workerStatus, function(err, data){
      var started = 0;
      for(var key in data){
        var id = key.split("#")[0];
        if(id == api.id){
          started++;
          api.log('clearing worker status: ' + key, 'debug');
          api.redis.client.hdel(api.tasks.queues.workerStatus, key, function(err){
            started--;
            if(started == 0){
              if(typeof callback == "function"){ callback(null, null); }
            }
          });
        }
      }
      if(started == 0){
        if(typeof callback == "function"){ callback(null, null); }
      }
    });
  }

  api.tasks.getAllLocalQueues = function(callback){
    api.redis.client.lrange("actionHero:peers",0,-1,function(err,peers){
      var allLocalQueues = [];
      for(var i in peers){
        allLocalQueues.push("actionHero:tasks:" + peers[i].replace(/:/g,"-"));
      }
      if(typeof callback == "function"){ callback(null, allLocalQueues); }
    });
  }

  api.tasks.copyToReleventLocalQueues = function(task, callback){
    api.tasks.getAllLocalQueues(function(err, allLocalQueues){
      var releventLocalQueues = []
      if(task.scope == "any"){
        // already moved
      }else{
        releventLocalQueues = allLocalQueues
      }
      if(releventLocalQueues.length == 0){
        if(typeof callback == "function"){ callback(); }
      }else{
        var started = 0;
        for(var i in releventLocalQueues){
          started++;
          var queue = releventLocalQueues[i];
          if(queue != api.tasks.queues.localQueue){
            var taskCopy = task.duplicate();
            taskCopy.enqueue(queue, function(err){
              if(err != null){ api.log(err, "error") }
              started--;
              if(started == 0){ if(typeof callback == "function"){ callback(); } }
            }); 
          }else{
            process.nextTick(function(){
              started--;
              if(started == 0){ if(typeof callback == "function"){ callback(); } }
            });
          }
        }
      }
    });
  }

  api.tasks.getAllTasks = function(nameToMatch, callback){
    if(callback == null && typeof nameToMatch == "function"){
      callback = nameToMatch;
      nameToMatch = null;
    }
    api.redis.client.hgetall(api.tasks.queues.data, function(err, data){
      var parsedData = {}
      for(var i in data){
        parsedData[i] = JSON.parse(data[i])
      }
      if(nameToMatch == null){
        if(typeof callback == "function"){ callback(err, parsedData); }
      }else{
        var results = {};
        for(var i in parsedData){
          if(parsedData[i].name == nameToMatch){
            results[i] = parsedData[i];
          }
        }
        if(typeof callback == "function"){ callback(err, results); }
      }
    });
  }

  api.tasks.setTaskData = function(taskId, data, callback){
    api.tasks.getTaskData(taskId, function(err, muxedData){
      if(muxedData == null && err == null){
        muxedData = {};
      }
      for(var i in data){
        muxedData[i] = data[i];
      }
      api.redis.client.hset(api.tasks.queues.data, taskId, JSON.stringify(muxedData), function(err){
        if(typeof callback == "function"){ callback(err, muxedData); }
      });
    });
  }

  api.tasks.getTaskData = function(taskId, callback){
    api.redis.client.hget(api.tasks.queues.data, taskId, function(err, data){
      try{
        data = JSON.parse(data);
      }catch(e){ 
        data = {}; 
      }
      if(typeof callback == "function"){ callback(err, data); }
    });
  }

  api.tasks.clearTaskData = function(taskId, callback){
    api.redis.client.hdel(api.tasks.queues.data, taskId, function(err){
      if(typeof callback == "function"){ callback(err); }
    });
  }

  api.tasks.placeInQueue = function(taskId, queue, callback){
    api.tasks.setTaskData(taskId, {queue: queue}, function(err){
      if(queue != api.tasks.queues.delayedQueue){
        api.redis.client.rpush(queue, taskId, function(err){
          if(typeof callback == "function"){ callback(err); }
        });
      }else{
        api.tasks.getTaskData(taskId, function(err, data){
          var delayedQueue = api.tasks.queues.delayedQueuePrefix + "@" + data.runAt;
          api.tasks.setTaskData(taskId, {queue: delayedQueue}, function(err){
            api.redis.client.lpush(delayedQueue, taskId, function(err){
              if(typeof callback == "function"){ callback(err); }
            });
          });
        });
      }
    });
  }

  api.tasks.queueLength = function(queue, callback){
    api.redis.client.llen(queue, function(err, length){
      if(typeof callback == "function"){ callback(err, length); }
    });
  }

  api.tasks.countDelayedTasks = function(callback){
    api.tasks.getAllTasks(function(err, allTasks){
      var delayedTasks = 0;
      for(var i in allTasks){
        var task = allTasks[i];
        if(task.state == "delayed"){
          delayedTasks++;
        }
      }
      callback(err, delayedTasks)
    });
  }

  api.tasks.removeFromQueue = function(taskId, queue, callback){
    api.tasks.clearTaskData(taskId, function(err){
      api.redis.client.lrem(queue, 1, taskId, function(err, count){
        if(typeof callback == "function"){ callback(err, count); }
      });
    });
  }

  api.tasks.popFromQueue = function(queue, callback){
    api.redis.client.lpop(queue, function(err, taskIdReturned){
      callback(err, taskIdReturned);
    });
  }

  api.tasks.changeQueue = function(startQueue, endQueue, callback){
    api.tasks.popFromQueue(startQueue, function(err, taskIdReturned){
      if(taskIdReturned == null){
        callback(err, null);
      }else{
        api.tasks.placeInQueue(taskIdReturned, endQueue, function(err){
          api.tasks.getTaskData(taskIdReturned, function(err, data){
            try{
              var task = new api.task(data)
              callback(err, task);
            }catch(e){
              api.log(e, 'error');
              api.tasks.removeFromQueue(data.id, endQueue, function(){
                callback(err, null);
              });
            }
          });
        });
      }
    });
  }

  api.tasks.getOldestDelayedQueue = function(callback){
    var oldestTimestamp = null;
    var oldestQueue = null;
    api.redis.client.keys(api.tasks.queues.delayedQueuePrefix + "*", function(err, queues){
      for(var i in queues){
        var queue = queues[i];
        var timestamp = parseFloat(queue.split("@")[1]);
        if(oldestTimestamp == null || timestamp < oldestTimestamp){
          oldestTimestamp = timestamp;
          oldestQueue = queue;
        }
      }
      callback(null, oldestQueue);
    });
  }

  api.tasks.promoteFromDelayedQueue = function(callback){
    api.tasks.getOldestDelayedQueue(function(err, oldestQueue){
      if(oldestQueue == null){
        if(typeof callback == 'function'){ callback(); }
      }else{
        var queueTimestamp = parseFloat(oldestQueue.split("@")[1]);
        if(queueTimestamp > new Date().getTime()){
          if(typeof callback == 'function'){ callback(); }
        }else{
          api.tasks.changeQueue(oldestQueue, api.tasks.queues.globalQueue, function(err, task){
            if(task == null){
              api.redis.client.del(oldestQueue, function(err){
                if(typeof callback == 'function'){ callback(err, task); }
              });
            }else{
              api.tasks.setTaskData(task.id, {state: 'pending' }, function(err){
                if(typeof callback == 'function'){ callback(err, task); }
              });
            }
          });
        }
      }
    });
  }

  api.tasks.getEnqueuedPeriodicTasks = function(callback){
    api.redis.client.lrange(api.tasks.queues.enqueuedPeriodicTasks, 0, -1, function(err, enqueuedPeriodicTasks){
      callback(null, enqueuedPeriodicTasks);
    });
  }

  api.tasks.denotePeriodicTaskAsEnqueued = function(task, callback){
    api.redis.client.lpush(api.tasks.queues.enqueuedPeriodicTasks, task.name, function(err){
      callback(err);
    });
  }

  api.tasks.denotePeriodicTaskAsClear = function(task, callback){
    api.redis.client.lrem(api.tasks.queues.enqueuedPeriodicTasks, 1, task.name, function(err){
      callback(err);
    });
  }

  api.tasks.seedPeriodicTasks = function(callback){
    if(api.utils.hashLength(api.tasks.tasks) == 0){
      callback();
    }else{
      var started = 0;
      for(var i in api.tasks.tasks){
        started++;
        var taskTemplate = api.tasks.tasks[i];
        (function(taskTemplate){
          if(taskTemplate.frequency > 0){
            var task = new api.task({
              name: taskTemplate.name,
              toAnnounce: taskTemplate.toAnnounce,
            });
            task.enqueue(function(err, resp){
              if(err != null){ 
                api.log(String(err).replace('Error: ', ""), 'info'); 
                process.nextTick(function(){ 
                  started--;
                  if(started == 0){ callback(); }
                })
              }else{
                api.tasks.denotePeriodicTaskAsEnqueued(task, function(err){
                  api.log("seeded periodic task " + task.name, "notice");
                  process.nextTick(function(){ 
                    started--;
                    if(started == 0){ callback(); }
                  })
                });
              }
            });
          }else{
            process.nextTick(function(){ 
              started--;
              if(started == 0){ callback(); }
            })
          }
        })(taskTemplate)
      }
    }
  }

  /////////////
  // LOADERS //
  /////////////  

  api.tasks.load = function(fullfFilePath, reload){
    if(reload == null){ reload = false; }

    var loadMessage = function(loadedTaskName){
      if(reload){
        loadMessage = "task (re)loaded: " + loadedTaskName + ", " + fullfFilePath;
      }else{
        var loadMessage = "task loaded: " + loadedTaskName + ", " + fullfFilePath;
      }
      api.log(loadMessage, "debug");
    }

    var parts = fullfFilePath.split("/");
    var file = parts[(parts.length - 1)];
    var taskName = file.split(".")[0];
    if(!reload){
      if(api.configData.general.developmentMode == true){
        api.watchedFiles.push(fullfFilePath);
        (function() {
          fs.watchFile(fullfFilePath, {interval:1000}, function(curr, prev){
            if(curr.mtime > prev.mtime){
              process.nextTick(function(){
                if(fs.readFileSync(fullfFilePath).length > 0){
                  var cleanPath;
                  if(process.platform === 'win32'){
                    cleanPath = fullfFilePath.replace(/\//g, "\\");
                  } else {
                    cleanPath = fullfFilePath;
                  }

                  delete require.cache[require.resolve(cleanPath)];
                  delete api.tasks.tasks[taskName]
                  api.tasks.load(fullfFilePath, true);
                }
              });
            }
          });
        })();
      }
    }
    try{
      var collection = require(fullfFilePath);
      if(api.utils.hashLength(collection) == 1){
        api.tasks.tasks[taskName] = require(fullfFilePath).task;
        validateTask(api.tasks.tasks[taskName]);
        loadMessage(taskName);
      }else{
        for(var i in collection){
          var task = collection[i];
          api.tasks.tasks[task.name] = task;
          validateTask(api.tasks.tasks[task.name]);
          loadMessage(task.name);
        }
      }
    }catch(err){
      api.exceptionHandlers.loader(fullfFilePath, err);
      delete api.tasks.tasks[taskName];
    }
  }

  var validateTask = function(task){
    var fail = function(msg){
      api.log(msg + "; exiting.", "emerg");
      process.exit();
    }
    if(typeof task.name != "string" || task.name.length < 1){
      fail("a task is missing `task.name`");
    }else if(typeof task.description != "string" || task.description.length < 1){
      fail("Task "+task.name+" is missing `task.description`");
    }else if(typeof task.scope != "string"){
      fail("Task "+task.name+" has no scope");
    }else if(typeof task.frequency != "number"){
      fail("Task "+task.name+" has no frequency");  
    }else if(typeof task.run != "function"){
      fail("Task "+task.name+" has no run method");
    }
  }
  
  var path = api.configData.general.paths.task
  if(fs.existsSync(path)){
    fs.readdirSync(path).forEach( function(file) {
      if(path[path.length - 1] != "/"){ path += "/"; } 
      var fullfFilePath = path + file;
      if (file[0] != "."){
        var stats = fs.statSync(fullfFilePath);
        if(stats.isDirectory()){
          loadFolder(fullfFilePath);
        }else if(stats.isSymbolicLink()){
          var realPath = readlinkSync(fullfFilePath);
          loadFolder(realPath);
        }else if(stats.isFile()){
          var ext = file.split('.')[1];
          if (ext === 'js')
            api.tasks.load(fullfFilePath);
        }else{
          api.log(file+" is a type of file I cannot read", "alert")
        }
      }
    });
  }else{
    api.log("no tasks folder found ("+path+"), skipping", "warning");
  }

  next();

}

/////////////////////////////////////////////////////////////////////
// exports
exports.tasks = tasks;
