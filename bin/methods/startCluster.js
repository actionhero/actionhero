//////////////////////////////////////////////////////////////////////////////////////////////////////
//
// TO START IN CONSOLE: "./bin/actionhero startCluster"
//
// ** Production-ready actionhero cluster **
// - be sure to enable redis so that workers can share state
// - workers which die will be restarted
// - maser/manager specific logging
// - pidfile for master
// - USR2 restarts (graceful reload of workers while handling requests)
//   -- Note, socket/websocket clients will be disconnected, but there will always be a worker to handle them
//   -- HTTP/HTTPS/TCP clients will be allowed to finish the action they are working on before the server goes down
// - TTOU and TTIN signals to subtract/add workers
// - WINCH to stop all workers
// - TCP, HTTP(S), and Web-socket clients will all be shared across the cluster
// - Can be run as a daemon or in-console
//   -- Simple Daemon: "actionhero startCluster --daemon"
//
// * Setting process titles does not work on windows or OSX
//
// This tool was heavily inspired by Ruby Unicorns [[ http://unicorn.bogomips.org/ ]]
//
//////////////////////////////////////////////////////////////////////////////////////////////////////

var fs        = require('fs');
var cluster   = require('cluster');
var path      = require('path');
var os        = require('os');
var async     = require('async');
var readline  = require('readline');
var winston   = require('winston');
var isrunning = require('is-running');

/////////////////////////////////////////

var WorkerClass = function(id, actionHeroCluster){
  var self = this;

  self.id = id;
  self.actionHeroCluster = actionHeroCluster;
};

WorkerClass.prototype.logPrefix = function(){
  var self = this;
  var s = '';
  s += '[worker #' + self.id;
  if(self.worker && self.worker.process){
    s += ' (' + self.worker.process.pid + ')]: ';
  }else{
    s += ']: ';
  }
  return s;
}

WorkerClass.prototype.start = function(){
  var self = this;

  self.worker = cluster.fork({
    title: self.actionHeroCluster.options.workerTitlePrefix + self.id,
    ACTIONHERO_TITLE: self.actionHeroCluster.options.workerTitlePrefix + self.id
  });

  self.worker.on('exit', function(){
    self.actionHeroCluster.log(self.logPrefix() + 'exited', 'info');
    self.actionHeroCluster.work();
  });

  self.worker.on('message', function(message){
    self.actionHeroCluster.work();

    if(message.state){
      self.actionHeroCluster.log(self.logPrefix() + message.state, 'info');
    }

    if(message.uncaughtException){
      self.actionHeroCluster.log(self.logPrefix() + 'uncaught exception => ' + message.uncaughtException.message, 'alert');
      message.uncaughtException.stack.forEach(function(line){
        self.actionHeroCluster.log(self.logPrefix() + '   ' + line, 'alert');
      });
    }

    if(message.unhandledRejection){
      self.actionHeroCluster.log('worker #' + self.worker.id + ' [' + self.worker.process.pid + ']: unhandled rejection => ' + message.unhandledRejection, 'alert');
    }
  });
};

WorkerClass.prototype.stop = function(){
  this.worker.send('stopProcess');
};

/////////////////////////////////////////

var ActionHeroCluster = function(args){
  var self = this;
  self.workers = [];

  self.options = self.defualts();
  for(var i in self.options){
    if(args[i] !== null && args[i] !== undefined){
      self.options[i] = args[i];
    }
  }

  var transports = []
  transports.push(
    new(winston.transports.File)({
      filename: self.options.logPath + '/' + self.options.logFile
    })
  );
  if(cluster.isMaster && args.silent !== true){
    transports.push(
      new(winston.transports.Console)({
        colorize: true,
        timestamp: true
      })
    )
  }

  self.logger = new(winston.Logger)({
    levels: winston.config.syslog.levels,
    transports: transports
  });
};

ActionHeroCluster.prototype.defualts = function(){
  return {
    expectedWorkers: os.cpus().length,
    flapCount: 0,
    execPath: __filename,
    pidPath: process.cwd() + '/pids',
    pidfile: 'cluster_pidfile',
    logPath: process.cwd() + '/log',
    logFile: 'cluster.log',
    workerTitlePrefix: 'actionhero-worker-',
    args: '',
  };
};

ActionHeroCluster.prototype.log = function(message, severity){
  var self = this;
  self.logger.log(severity, message);
}

ActionHeroCluster.prototype.configurePath = function(p, callback){
  var stats = fs.lstatSync(p);
  if(!stats.isDirectory()){
    fs.mkdir(p, callback);
  }else{
    process.nextTick(callback);
  }
};

ActionHeroCluster.prototype.writePidFile = function(callback){
  var self = this;
  var file = self.options.pidPath + '/' + self.options.pidfile;

  if(fs.existsSync(file)){
    var oldpid = parseInt(fs.readFileSync(file));
    if( isrunning(oldpid) ){
      return callback(new Error('actionHeroCluster already running (pid ' + oldpid + ')'));
    }
  }

  fs.writeFileSync(file, process.pid);
  process.nextTick(callback);
}

ActionHeroCluster.prototype.start = function(callback){
  var self = this;
  var jobs = [];

  cluster.setupMaster({
    exec: self.options.execPath,
    args: self.options.args.split(' '),
    silent: true
  });

  process.on('SIGINT', function(){
    self.log('Signal: SIGINT', 'info');
    self.stop(process.exit);
  });

  process.on('SIGTERM', function(){
    self.log('Signal: SIGTERM', 'info');
    self.stop(process.exit);
  });

  // process.on('SIGUSR2', function(){
  //   self.log('Signal: SIGUSR2', 'info');
  //   self.log('swap out new workers one-by-one', 'info');
  //   self.workerRestartArray = [];
  //   for(var i in cluster.workers){
  //     self.workerRestartArray.push(cluster.workers[i]);
  //   }
  //   self.workerRestartArray.reverse();
  //   self.reloadAWorker();
  // });

  process.on('SIGHUP', function(){
    self.log('Signal: SIGHUP', 'info');
    self.log('reload all workers now', 'info');
    self.workers.forEach(function(worker){
      worker.send('restart');
    });
  });

  process.on('SIGTTIN', function(){
    self.log('Signal: SIGTTIN', 'info');
    self.log('add a worker', 'info');
    self.options.expectedWorkers++;
    self.work();
  });

  process.on('SIGTTOU', function(){
    self.log('Signal: SIGTTOU', 'info');
    self.log('remove a worker', 'info');
    self.options.expectedWorkers--;
    self.work();
  });

  if(process.platform === 'win32' && !process.env.IISNODE_VERSION){
    var rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    rl.on('SIGINT', function(){
      process.emit('SIGINT');
    });
  }

  jobs.push(function(done){
    self.log(' - STARTING CLUSTER -', 'notice');
    self.log('pid: ' + process.pid, 'notice');
    process.nextTick(done);
  });

  jobs.push(function(done){ self.configurePath(self.options.logPath, done); });
  jobs.push(function(done){ self.configurePath(self.options.pidPath, done); });
  jobs.push(function(done){ self.writePidFile(done); });

  async.series(jobs, function(error){
    if(error){
      self.log(error, 'error');
      process.exit(1);
    }
    else{
      self.work();
      if(typeof callback === 'function'){ callback(); }
    }
  });
};

ActionHeroCluster.prototype.stop = function(callback){
  var self = this;

  if(self.options.expectedWorkers > 0){
    self.options.expectedWorkers = 0;
    self.work();
  }

  if(self.workers.length === 0){
    self.log('All workers stopped');
    callback();
  }else{
    self.log(self.workers.length  + ' workers running, waiting on stop');
    setTimeout(function(){ self.stop(callback); }, 1000);
  }
};

ActionHeroCluster.prototype.sortWorkers = function(){
  var self = this;
  self.workers.sort(function(a,b){ return (a.id > b.id); });
};

ActionHeroCluster.prototype.work = function(){
  var self = this;
  var worker;
  self.sortWorkers();

  if(self.options.expectedWorkers < self.workers.length){
    worker = self.workers[ (self.workers.length - 1) ];
    self.log('signaling worker #' + worker.id + ' to stop');
    worker.stop();
  }

  else if(self.options.expectedWorkers > self.workers.length){
    var workerId = 1;
    self.workers.forEach(function(w){
      if(w.id === workerId){ workerId++; }
    });

    self.log('starting worker #' + workerId);
    worker = new WorkerClass(workerId, self);
    worker.start();
    self.workers.push(worker);
    self.sortWorkers();
  }

  else{
    self.log('cluster exilibrium state reated @ ' + self.workers.length + ' workers');
  }
};

/////////////////////////////////////////

exports.startCluster = function(binary){
  var options = {
    execCommand: path.normalize(binary.paths.actionheroRoot + '/bin/actionhero'),
    args: 'start',
    silent: (binary.argv.silent === 'true' || binary.argv.silent === true) ? true : false,
  };

  var ahc = new ActionHeroCluster(options);
  ahc.start();
};






















//
// binary.clusterConfig = {
//   exec: binary.execCMD,
//   args: 'start',
//   workers: binary.numWorkers,
//   pidfile: binary.pidPath + '/cluster_pidfile',
//   log: process.cwd() + '/log/cluster.log',
//   title: 'actionhero-master',
//   workerTitlePrefix: 'actionhero-worker-'
// };


//
//
//
// exports.startCluster = function(binary){
//   async.series({
//
//     workerMethods: function(next){
//
//       binary.claimWorkerId = function(){
//         var expectedWorkerIds = []
//         var i = 1;
//         while(i <= binary.workersExpected){
//           expectedWorkerIds.push(i);
//           i++;
//         }
//         for(i in binary.claimedWorkerIds){
//           var thisWorkerId = binary.claimedWorkerIds[i];
//           expectedWorkerIds.splice(expectedWorkerIds.indexOf(thisWorkerId),1);
//         }
//         var workerId = expectedWorkerIds[0];
//         binary.claimedWorkerIds.push(workerId);
//         return workerId;
//       }
//
//       binary.releaseWorkerId = function(thisWorkerId){
//         binary.claimedWorkerIds.splice(binary.claimedWorkerIds.indexOf(thisWorkerId),1);
//       }
//
//       binary.startAWorker = function(){
//         var workerID = binary.claimWorkerId();
//
//         if(binary.workerRestartArray.length > 0){
//           workerID = workerID - binary.workerRestartArray.length;
//         }
//
//         var worker = cluster.fork({
//           title: binary.clusterConfig.workerTitlePrefix + workerID,
//           ACTIONHERO_TITLE: binary.clusterConfig.workerTitlePrefix + workerID
//         });
//
//         worker.workerID = workerID;
//         binary.log('starting worker #' + worker.workerID, 'info');
//         worker.on('message', function(message){
//           if(message.state && worker.state !== 'none'){
//             binary.log('Worker #' + worker.workerID + ' [' + worker.process.pid + ']: ' + message.state, 'info');
//           }
//
//           if(message.uncaughtException){
//             binary.log('Worker #' + worker.workerID + ' [' + worker.process.pid + ']: uncaught exception => ' + message.uncaughtException.message, 'alert');
//             message.uncaughtException.stack.forEach(function(line){
//               binary.log('Worker #' + worker.workerID + ' [' + worker.process.pid + ']:   ' + line, 'alert');
//             });
//           }
//
//           if(message.unhandledRejection){
//             binary.log('Worker #' + worker.workerID + ' [' + worker.process.pid + ']: unhandled rejection => ' + message.unhandledRejection, 'alert');
//           }
//         });
//       }
//
//       binary.setupShutdown = function(){
//         if(binary.workersExpected > 0){
//           binary.workersExpected = 0;
//           binary.log('Cluster manager quitting', 'warning');
//           binary.log('Stopping each worker...', 'info');
//           for(var i in cluster.workers){
//             cluster.workers[i].send('stopProcess');
//           }
//           setTimeout(binary.loopUntilNoWorkers, loopSleep);
//         }
//       }
//
//       binary.loopUntilNoWorkers = function(){
//         if(binary.utils.hashLength(cluster.workers) > 0){
//           binary.log('there are still ' + binary.utils.hashLength(cluster.workers) + ' workers...', 'warning');
//           setTimeout(binary.loopUntilNoWorkers, loopSleep);
//         } else {
//           binary.log('all workers gone', 'info');
//           if(binary.clusterConfig.pidfile){
//             try { fs.unlinkSync(binary.clusterConfig.pidfile); } catch(e){}
//           }
//           setTimeout(process.exit, 500);
//         }
//       }
//
//       binary.loopUntilAllWorkers = function(){
//         if(binary.utils.hashLength(cluster.workers) < binary.workersExpected){
//           binary.startAWorker();
//           setTimeout(binary.loopUntilAllWorkers, loopSleep);
//         }
//       }
//
//       binary.reloadAWorker = function(){
//         var count = binary.utils.hashLength(cluster.workers)
//         if(binary.workersExpected > count){
//           binary.startAWorker();
//         }
//         if(binary.workerRestartArray.length > 0){
//           var worker = binary.workerRestartArray.pop();
//           worker.send('stopProcess');
//         }
//       }
//
//       binary.detectFlapping = function(){
//         flapCount++;
//         if(binary.workersExpected > 0 && flapCount > (binary.workersExpected * 3)){
//           binary.log('cluster is flapping, exiting now', 'warning');
//           binary.setupShutdown();
//         }
//       }
//
//       binary.cleanup = function(){
//
//       }
//
//       next();
//     },
//
//     process: function(next){
//       process.stdin.resume();
//       binary.workerRestartArray = []; // used to track rolling restarts of workers
//       binary.workersExpected = 0;
//
//       // signals
//       process.on('SIGINT', function(){
//         binary.log('Signal: SIGINT', 'info');
//         binary.setupShutdown();
//       });
//
//       process.on('SIGTERM', function(){
//         binary.log('Signal: SIGTERM', 'info');
//         binary.setupShutdown();
//       });
//
//       process.on('SIGUSR2', function(){
//         binary.log('Signal: SIGUSR2', 'info');
//         binary.log('swap out new workers one-by-one', 'info');
//         binary.workerRestartArray = [];
//         for(var i in cluster.workers){
//           binary.workerRestartArray.push(cluster.workers[i]);
//         }
//         binary.workerRestartArray.reverse();
//         binary.reloadAWorker();
//       });
//
//       process.on('SIGHUP', function(){
//         binary.log('Signal: SIGHUP', 'info');
//         binary.log('reload all workers now', 'info');
//         for (var i in cluster.workers){
//           var worker = cluster.workers[i];
//           worker.send('restart');
//         }
//       });
//
//       process.on('SIGWINCH', function(){
//         if(binary.isDaemon){
//           binary.log('Signal: SIGWINCH', 'info');
//           binary.log('stop all workers', 'info');
//           binary.workersExpected = 0;
//           for (var i in cluster.workers){
//             var worker = cluster.workers[i];
//             worker.send('stopProcess');
//           }
//         }
//       });
//
//       process.on('SIGTTIN', function(){
//         binary.log('Signal: SIGTTIN', 'info');
//         binary.log('add a worker', 'info');
//         binary.workersExpected++;
//         binary.startAWorker();
//       });
//
//       process.on('SIGTTOU', function(){
//         binary.log('Signal: SIGTTOU', 'info');
//         binary.log('remove a worker', 'info');
//         binary.workersExpected--;
//         for(var i in cluster.workers){
//           var worker = cluster.workers[i];
//           worker.send('stopProcess');
//           break;
//         }
//       });
//
//       process.on('exit', function(){
//         binary.cleanup();
//         binary.workersExpected = 0;
//         binary.log('cluster complete, Bye!', 'notice')
//       });
//
//       if(process.platform === 'win32' && !process.env.IISNODE_VERSION){
//         var rl = readline.createInterface({
//           input: process.stdin,
//           output: process.stdout
//         });
//         rl.on('SIGINT', function(){
//           process.emit('SIGINT');
//         });
//       }
//
//       next();
//     },
//
//     start: function(){
//       // cluster.setupMaster({
//       //   exec : binary.clusterConfig.exec,
//       //   args: binary.clusterConfig.args.split(' '),
//       //   silent: true
//       // });
//
//       for (var i = 0; i < binary.clusterConfig.workers; i++) {
//         binary.workersExpected++;
//       }
//
//       setInterval(function(){
//         flapCount = 0;
//       }, binary.workersExpected * loopSleep * 4);
//
//       // cluster.on('fork', function(worker) {
//       //   binary.log('worker ' + worker.process.pid + ' (#' + worker.workerID + ') has spawned', 'info');
//       // });
//
//       cluster.on('exit', function(worker) {
//         binary.log('worker ' + worker.process.pid + ' (#' + worker.workerID + ') has exited', 'alert');
//         binary.releaseWorkerId(worker.workerID);
//         // to prevent CPU explosions if crashing too fast
//         setTimeout(binary.reloadAWorker, loopSleep / 2);
//         binary.detectFlapping();
//       });
//
//       binary.loopUntilAllWorkers();
//     }
//   });
