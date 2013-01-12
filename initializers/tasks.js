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
    delayedQueue: 'actionHero:tasks:delayed',
    localQueue: 'actionHero:tasks:' + api.id.replace(/:/g,'-'),
    processingQueue: 'actionHero:tasks:processing',
    data: 'actionHero:tasks:data', // actually a hash
  }

  if(api.redis.enable === true){
    //
  }else{
    api.tasks.queueData = {};
    api.tasks.queueData[api.tasks.queues.globalQueue] = [];
    api.tasks.queueData[api.tasks.queues.delayedQueue] = [];
    api.tasks.queueData[api.tasks.queues.localQueue] = [];
    api.tasks.queueData[api.tasks.queues.processingQueue] = [];
    api.tasks.queueData[api.tasks.queues.data] = {};
  }

  api.tasks._start = function(api, next){
    api.tasks.saveStuckDelayedTasks(function(){
      api.tasks.savePreviouslyCrashedTasks(function(){
        api.tasks.seedPeriodicTasks(function(){
          next();
        });
      });
    });
  }

  api.tasks.getAllLocalQueues = function(callback){
    if(api.redis.enable === true){
      api.redis.client.lrange("actionHero:peers",0,-1,function(err,peers){
        var allLocalQueues = [];
        for(var i in peers){
          allLocalQueues.push("actionHero:tasks:" + peers[i].replace(/:/g,"-"));
        }
        if(typeof callback == "function"){ callback(null, allLocalQueues); }
      });
    }
  }

  api.tasks.copyToReleventLocalQueues = function(task, callback){
    if(api.redis.enable === true){
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
              taskCopy.enqueue(queue, function(){
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
      })
    }else{
      process.nextTick(function(){
        if(typeof callback == "function"){ callback(); }
      });
    }
  }

  api.tasks.getAllTasks = function(nameToMatch, callback){
    if(callback == null && typeof nameToMatch == "function"){
      callback = nameToMatch;
      nameToMatch = null;
    }
    if(api.redis.enable === true){
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
    }else{
      process.nextTick(function(){
        if(typeof callback == "function"){ callback(null, api.tasks.queueData[api.tasks.queues.data]); }
      });
    }
  }

  api.tasks.setTaskData = function(taskId, data, callback){
    if(api.redis.enable === true){
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
    }else{
      var muxedData = api.tasks.queueData[api.tasks.queues.data][taskId];
      if(muxedData == null){ muxedData = {}; }
      for(var i in data){
        muxedData[i] = data[i];
      }
      api.tasks.queueData[api.tasks.queues.data][taskId] = muxedData;
      process.nextTick(function(){
        if(typeof callback == "function"){ callback(null, muxedData); }
      });
    }
  }

  api.tasks.getTaskData = function(taskId, callback){
    if(api.redis.enable === true){
      api.redis.client.hget(api.tasks.queues.data, taskId, function(err, data){
        try{
          data = JSON.parse(data);
        }catch(e){ 
          data = {}; 
        }
        if(typeof callback == "function"){ callback(err, data); }
      });
    }else{
      process.nextTick(function(){
        if(typeof callback == "function"){ callback(null, api.tasks.queueData[api.tasks.queues.data][taskId]); }
      });
    }
  }

  api.tasks.clearTaskData = function(taskId, callback){
    if(api.redis.enable === true){
      api.redis.client.hdel(api.tasks.queues.data, taskId, function(err){
        if(typeof callback == "function"){ callback(err); }
      });
    }else{
      delete api.tasks.queueData[api.tasks.queues.data][taskId];
      process.nextTick(function(){
        if(typeof callback == "function"){ callback(null); }
      });
    }
  }

  api.tasks.placeInQueue = function(taskId, queue, callback){
    api.tasks.setTaskData(taskId, {queue: queue}, function(err){
      if(api.redis.enable === true){
        api.redis.client.rpush(queue, taskId, function(err){
          if(typeof callback == "function"){ callback(err); }
        });
      }else{
        process.nextTick(function(){
          api.tasks.queueData[queue].push(taskId);
          if(typeof callback == "function"){ callback(null); }
        });
      }
    });
  }

  api.tasks.queueLength = function(queue, callback){
    if(api.redis.enable === true){
      api.redis.client.llen(queue, function(err, length){
        if(typeof callback == "function"){ callback(err, length); }
      });
    }else{
      process.nextTick(function(){
        if(typeof callback == "function"){ callback(null, api.tasks.queueData[queue].length); }
      });
    }
  }

  api.tasks.removeFromQueue = function(taskId, queue, callback){
    api.tasks.clearTaskData(taskId, function(err){
      if(api.redis.enable === true){
        api.redis.client.lrem(queue, 1, taskId, function(err, count){
          if(typeof callback == "function"){ callback(err, count); }
        });
      }else{
        var queueData = api.tasks.queueData[queue];
        for(var i in queueData){
          if(queueData[i].id == taskId){
            queueData.splice(i,1);
            break;
          }
        }
        if(typeof callback == "function"){ callback(null, 0); }
      }
    });
  }

  api.tasks.popFromQueue = function(queue, callback){
    if(api.redis.enable === true){
      api.redis.client.lpop(queue, function(err, taskIdReturned){
        callback(err, taskIdReturned);
      });
    }else{
      process.nextTick(function(){ 
        var queueData = api.tasks.queueData[queue];
        taskIdReturned = queueData.splice(0,1)[0];
        if(taskIdReturned == null){ taskIdReturned = null; }
        callback(null, taskIdReturned); 
      })
    }
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
              api.log(e, 'red');
              api.tasks.removeFromQueue(data.id, endQueue, function(){
                callback(err, null);
              });
            }
          });
        });
      }
    });
  }

  api.tasks.promoteFromDelayedQueue = function(callback){
    api.tasks.popFromQueue(api.tasks.queues.delayedQueue, function(err, taskIdReturned){
      if(taskIdReturned == null){
        callback(err, null);
      }else{
        api.tasks.getTaskData(taskIdReturned, function(err, data){
          try{
            var task = new api.task(data);
            if(task.runAt < new Date().getTime()){
              api.tasks.setTaskData(taskIdReturned, {state: 'pending'}, function(err){
                api.tasks.placeInQueue(taskIdReturned, api.tasks.queues.globalQueue, function(err){
                  callback(err, task);
                });
              });
            }else{
              api.tasks.placeInQueue(taskIdReturned, api.tasks.queues.delayedQueue, function(err){
                callback(err, null);
              });
            }
          }catch(e){
            api.log(e, 'red');
            api.tasks.removeFromQueue(data.id, api.tasks.queues.delayedQueue, function(){
              callback(err, null);
            });
          }
        });
      }
    });
  }

  api.tasks.seedPeriodicTasks = function(callback){
    if(api.tasks.tasks.length == 0){
      callback();
    }else{
      var started = 0;
      for(var i in api.tasks.tasks){
        started++;
        var taskTemplate = api.tasks.tasks[i];
        if(taskTemplate.frequency > 0){
          var task = new api.task({name: taskTemplate.name});
          task.enqueue(function(err, resp){
            if(err != null){ 
              api.log(String(err).replace('Error: ', ""), 'yellow'); 
            }else{
              api.log("seeded preiodoc task " + task.name, "yellow");
            }
            process.nextTick(function(){ 
              started--;
              if(started == 0){ callback(); }
            })
          });
        }else{
          process.nextTick(function(){ 
            started--;
            if(started == 0){ callback(); }
          })
        }
      }
    }
  }

  api.tasks.savePreviouslyCrashedTasks = function(callback){
    api.tasks.changeQueue(api.tasks.queues.processingQueue, api.tasks.queues.globalQueue, function(err, task){
      if(task != null){
        api.log('restarting a previously interupted/crashed task ' + task.name, 'yellow');
        api.tasks.savePreviouslyCrashedTasks(callback);
      }else{
        callback();
      }
    });
  }

  api.tasks.saveStuckDelayedTasks = function(callback){
    if(api.redis.enable === true){
      api.tasks.getAllTasks(function(err, tasks){
        api.redis.client.lrange(api.tasks.queues.delayedQueue, 0, 1, function(err, delayedIds){
          if(api.utils.hashLength(tasks) == 0){
            callback();
          }
          for(var i in tasks){
            var started = 0;
            var taskDetails = tasks[i];
            if(taskDetails.queue == api.tasks.queues.delayedQueue && taskDetails.runAt < (new Date().getTime() - 5000) ){
              if(delayedIds.indexOf(taskDetails.id) < 0){
                started++;
                api.log('saving a delayed task which was lost in a shutdown' + taskDetails.name, 'yellow');
                api.tasks.placeInQueue(taskDetails.id, api.tasks.queues.delayedQueue, function(){
                  started--;
                  if(started == 0){ callback(); }
                });
              }
            }
          }
          if(started == 0){ callback(); }
        });
      });
    }else{
      callback();
    }
  }

  api.tasks.load = function(api){
    var validateTask = function(task){
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
              taskLoader(fullfFilePath)
            }else{
              api.log(file+" is a type of file I cannot read", "red")
            }
          }
        });
      }else{
        api.log("No tasks folder found, skipping...");
      }
    }

    var taskLoader = function(fullfFilePath, reload){
      if(reload == null){ reload = false; }

      var loadMessage = function(loadedTaskName){
        if(reload){
          loadMessage = "task (re)loaded: " + loadedTaskName + ", " + fullfFilePath;
        }else{
          var loadMessage = "task loaded: " + loadedTaskName + ", " + fullfFilePath;
        }
        api.log(loadMessage, "yellow");
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
                    delete require.cache[fullfFilePath];
                    delete api.tasks.tasks[taskName];
                    taskLoader(fullfFilePath, true);
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

    var taskFolders = [ 
      process.cwd() + "/tasks/", 
    ]

    for(var i in taskFolders){
      loadFolder(taskFolders[i]);
    }
  }

  api.tasks.load(api); // run right away
  next();

}

/////////////////////////////////////////////////////////////////////
// exports
exports.tasks = tasks;
