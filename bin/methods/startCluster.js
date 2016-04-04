'use strict';

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

var Worker = function(parent, id, env){
  var self = this;
  self.state = null;
  self.id = id;
  self.env = env;
  self.parent = parent;
};

Worker.prototype.logPrefix = function(){
  var self = this;
  var s = '';
  s += '[worker #' + self.id;
  if(self.worker && self.worker.process){
    s += ' (' + self.worker.process.pid + ')]: ';
  }else{
    s += ']: ';
  }
  return s;
};

Worker.prototype.start = function(){
  var self = this;

  self.worker = cluster.fork(self.env);

  self.worker.on('exit', function(){
    self.parent.log(self.logPrefix() + 'exited', 'info');

    for(var i in self.parent.workers){
      if(self.parent.workers[i].id === self.id){
        self.parent.workers.splice(i, 1);
        break;
      }
    }

    self.parent.work();
  });

  self.worker.on('message', function(message){
    if(message.state){
      self.state = message.state;
      self.parent.log(self.logPrefix() + message.state, 'info');
    }

    if(message.uncaughtException){
      self.parent.log(self.logPrefix() + 'uncaught exception => ' + message.uncaughtException.message, 'alert');
      message.uncaughtException.stack.forEach(function(line){
        self.parent.log(self.logPrefix() + '   ' + line, 'alert');
      });
      self.parent.flapCount++;
    }

    if(message.unhandledRejection){
      self.parent.log('worker #' + self.worker.id + ' [' + self.worker.process.pid + ']: unhandled rejection => ' + JSON.stringify(message.unhandledRejection), 'alert');
      self.parent.flapCount++;
    }

    self.parent.work();
  });
};

Worker.prototype.stop = function(){
  this.worker.send('stopProcess');
};

Worker.prototype.restart = function(){
  this.worker.send('restart');
};

/////////////////////////////////////////

var ActionHeroCluster = function(args){
  var self = this;
  self.workers = [];
  self.workersToRestart = [];
  self.flapCount = 0;

  self.options = self.defaults();
  for(var i in self.options){
    if(args[i] !== null && args[i] !== undefined){
      self.options[i] = args[i];
    }
  }

  var transports = [];
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
    );
  }

  self.logger = new(winston.Logger)({
    levels: winston.config.syslog.levels,
    transports: transports
  });
};

ActionHeroCluster.prototype.defaults = function(){
  return {
    stopTimeout: 3000,
    expectedWorkers: os.cpus().length,
    flapWindow: 1000 * 30,
    execPath: __filename,
    pidPath: process.cwd() + '/pids',
    pidfile: 'cluster_pidfile',
    logPath: process.cwd() + '/log',
    logFile: 'cluster.log',
    workerTitlePrefix: 'actionhero-worker-',
    args: '',
    buildEnv: null,
  };
};

ActionHeroCluster.prototype.log = function(message, severity){
  var self = this;
  self.logger.log(severity, message);
};

ActionHeroCluster.prototype.buildEnv = function(workerId){
  var self = this;
  if(typeof self.options.buildEnv === 'function'){
    return self.options.buildEnv.call(self, workerId);
  }else{
    return {
      title: self.options.workerTitlePrefix + workerId,
    };
  }
};

ActionHeroCluster.prototype.configurePath = function(p, callback){
  var stats = fs.lstatSync(p);
  if(stats.isDirectory() || stats.isSymbolicLink()){
    process.nextTick(callback);
  }else{
    fs.mkdir(p, callback);
  }
};

ActionHeroCluster.prototype.writePidFile = function(callback){
  var self = this;
  var file = self.options.pidPath + '/' + self.options.pidfile;

  if(fs.existsSync(file)){
    var oldpid = parseInt(fs.readFileSync(file));
    if(isrunning(oldpid)){
      return callback(new Error('actionHeroCluster already running (pid ' + oldpid + ')'));
    }
  }

  fs.writeFileSync(file, process.pid);
  process.nextTick(callback);
};

ActionHeroCluster.prototype.start = function(callback){
  var self = this;
  var jobs = [];

  self.log(JSON.stringify(self.options), 'debug');

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

  process.on('SIGUSR2', function(){
    self.log('Signal: SIGUSR2', 'info');
    self.log('swap out new workers one-by-one', 'info');
    self.workers.forEach(function(worker){
      self.workersToRestart.push(worker.id);
    });
    self.work();
  });

  process.on('SIGHUP', function(){
    self.log('Signal: SIGHUP', 'info');
    self.log('reload all workers now', 'info');
    self.workers.forEach(function(worker){
      worker.restart();
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

  jobs.push(function(done){
    if(self.flapTimer){ clearInterval(self.flapTimer); }
    self.flapTimer = setInterval(function(){
      if(self.flapCount > (self.options.expectedWorkers * 2)){
        self.log('CLUSTER IS FLAPPING (' + self.flapCount + ' crashes in ' + self.options.flapWindow + 'ms). Stopping', 'emerg');
        self.stop(process.exit);
      }else{
        self.flapCount = 0;
      }
    }, self.options.flapWindow);

    done();
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

  if(self.workers.length === 0){
    self.log('all workers stopped', 'notice');
    callback();
  }else{
    self.log(self.workers.length  + ' workers running, waiting on stop', 'info');
    setTimeout(function(){ self.stop(callback); }, self.options.stopTimeout);
  }

  if(self.options.expectedWorkers > 0){
    self.options.expectedWorkers = 0;
    self.work();
  }
};

ActionHeroCluster.prototype.sortWorkers = function(){
  var self = this;
  self.workers.sort(function(a, b){ return (a.id - b.id); });
};

ActionHeroCluster.prototype.work = function(){
  var self = this;
  var worker;
  var workerId;
  self.sortWorkers();
  var stateCounts = {};

  self.workers.forEach(function(w){
    if(!stateCounts[w.state]){ stateCounts[w.state] = 0; }
    stateCounts[w.state]++;
  });

  if(
      self.options.expectedWorkers < self.workers.length &&
      !stateCounts.stopping &&
      !stateCounts.stopped &&
      !stateCounts.restarting
    ){
    worker = self.workers[(self.workers.length - 1)];
    self.log('signaling worker #' + worker.id + ' to stop', 'info');
    worker.stop();
  }

  else if(
      self.options.expectedWorkers > self.workers.length &&
      !stateCounts.starting &&
      !stateCounts.restarting
    ){
    workerId = 1;
    self.workers.forEach(function(w){
      if(w.id === workerId){ workerId++; }
    });

    self.log('starting worker #' + workerId, 'info');
    var env = self.buildEnv(workerId);
    worker = new Worker(self, workerId, env);
    worker.start();
    self.workers.push(worker);
  }

  else if(
    self.workersToRestart.length > 0 &&
    !stateCounts.starting &&
    !stateCounts.stopping &&
    !stateCounts.stopped &&
    !stateCounts.restarting
  ){
    workerId = self.workersToRestart.pop();
    self.workers.forEach(function(w){
      if(w.id === workerId){ w.stop(); }
    });
  }

  else{
    if(stateCounts.started === self.workers.length){
      self.log('cluster equilibrium state reached with ' + self.workers.length + ' workers', 'notice');
    }
  }
};

/////////////////////////////////////////

exports.startCluster = function(binary){
  var options = {
    execPath: path.normalize(binary.actionheroRoot + '/bin/actionhero'),
    args: 'start',
    silent: (binary.argv.silent === 'true' || binary.argv.silent === true) ? true : false,
    expectedWorkers: binary.argv.workers,
    buildEnv: function(workerId){
      var self = this;
      var env  = {};

      for(var k in process.env){
        env[k] = process.env[k];
      }

      var title = self.options.workerTitlePrefix + workerId;
      env.title = title;
      env.ACTIONHERO_TITLE = title;

      return env;
    }
  };

  var ahc = new ActionHeroCluster(options);
  ahc.start();
};
