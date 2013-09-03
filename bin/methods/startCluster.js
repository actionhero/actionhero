//////////////////////////////////////////////////////////////////////////////////////////////////////
// 
// TO START IN CONSOLE: `./bin/actionHero startCluster`
// TO DAMEONIZE: `forever ./bin/actionHero startCluster` 
// 
// ** Producton-ready actionHero cluster **
// - be sure to enable redis so that workers can share state
// - workers which die will be restarted
// - maser/manager specific logging
// - pidfile for master
// - USR2 restarts (graceful reload of workers while handling requets)
//   -- Note, socket/websocket clients will be disconnected, but there will always be a worker to handle them
//   -- HTTP, HTTPS, and TCP clients will be allowed to finish the action they are working on before the server goes down
// - TTOU and TTIN signals to subtract/add workers
// - WINCH to stop all workers
// - TCP, HTTP(s), and Web-socket clients will all be shared across the cluster
// - Can be run as a daemon or in-console
//   -- Lazy Dameon: `nohup ./bin/actionHero startCluster &`
//   -- you may want to explore `forever` as a dameonizing option
//
// * Setting process titles does not work on windows or OSX
// 
// This example was heavily inspired by Ruby Unicorns [[ http://unicorn.bogomips.org/ ]]
// 
//////////////////////////////////////////////////////////////////////////////////////////////////////

var fs = require('fs');
var cluster = require('cluster');
var path = require('path');
var async = require('async');
var readline = require('readline');

exports['startCluster'] = function(binary, next){

  var loopSleep = 1500;

  async.series({
    setup: function(next){
      binary.numCPUs = require('os').cpus().length
      binary.numWorkers = binary.numCPUs - 2;
      binary.claimedWorkerIds = [];
      if (binary.numWorkers < 2){ binary.numWorkers = 2};
      binary.execCMD = path.normalize(binary.paths.actionHero_root + "/bin/actionHero");
      next();
    },
    pids: function(next){
      binary.pidPath = process.cwd() + "/pids";
      try{
        stats = fs.lstatSync(binary.pidPath);
        if(!stats.isDirectory()){
          fs.mkdirSync(binary.pidPath);
        }
      }catch(e){
        try{
          fs.mkdirSync(binary.pidPath);
        }catch(e){ }
      }
      next();
    },
    config: function(next){
      binary.clusterConfig = {
        exec: binary.execCMD, 
        args: "start",
        workers: binary.numWorkers,
        pidfile: binary.pidPath + "/cluster_pidfile",
        log: process.cwd() + "/log/cluster.log",
        title: "actionHero-master",
        workerTitlePrefix: "actionHero-worker",
      };

      for(var i in binary.clusterConfig){
        if(binary.argv[i] != null && i != 'args'){
          binary.clusterConfig[i] = binary.argv[i];
        }
      }

      if(binary.argv["config"] != null){ binary.clusterConfig.args += " --config=" + binary.argv["config"]; }

      next();
    },
    log: function(next){
      var winston = require('winston');
      binary.logger.add(winston.transports.File, { filename: binary.clusterConfig.log });

      next();
    },
    displaySetup: function(next){
      binary.log(" - STARTING CLUSTER -", "notice");
      binary.log("pid: "+process.pid, "notice");
      binary.log("options:", "debug");
      for(var i in binary.clusterConfig){
        binary.log(" > " + i + ": " + binary.clusterConfig[i], "debug");
      }
      binary.log("", "debug");

      next();
    },
    pidFile: function(next){
      if(binary.clusterConfig.pidfile != null){
        fs.writeFileSync(binary.clusterConfig.pidfile, process.pid.toString(), 'ascii');
      }

      next();
    },
    workerMethods: function(next){
      binary.claimWorkerId = function(){
        var runningWorkersCount = (binary.utils.hashLength(cluster.workers));
        var expectedWorkerIds = []
        var i = 1;
        while(i <= binary.workersExpected){
          expectedWorkerIds.push(i);
          i++;
        }
        for(var i in binary.claimedWorkerIds){
          var thisWorkerId = binary.claimedWorkerIds[i];
          expectedWorkerIds.splice(expectedWorkerIds.indexOf(thisWorkerId),1);
        }
        var workerId = expectedWorkerIds[0];
        binary.claimedWorkerIds.push(workerId);
        return workerId;
      },
      binary.releaseWorkerId = function(thisWorkerId){
        binary.claimedWorkerIds.splice(binary.claimedWorkerIds.indexOf(thisWorkerId),1);
      }
      binary.startAWorker = function(){
        var workerID = (binary.utils.hashLength(cluster.workers)) + 1;
        var workerID = binary.claimWorkerId();
        if(binary.workerRestartArray.length > 0){
          workerID = workerID - binary.workerRestartArray.length;
        }
        var worker = cluster.fork({
          title: binary.clusterConfig.workerTitlePrefix + workerID
        });
        worker.workerID = workerID
        binary.log("starting worker #" + worker.workerID, "info");
        worker.on('message', function(message){
          if(worker.state != "none"){
            binary.log("Worker #" + worker.workerID + " ["+worker.process.pid+"]: " + message, "info");
          }
        });
      }

      binary.setupShutdown = function(){
        binary.log("Cluster manager quitting", "warning");
        binary.log("Stopping each worker...", "info");
        for(var i in cluster.workers){
          cluster.workers[i].send('stopProcess');
        }
        setTimeout(binary.loopUntilNoWorkers, loopSleep);
      }

      binary.loopUntilNoWorkers = function(){
        if(binary.utils.hashLength(cluster.workers) > 0){
          binary.log("there are still " + binary.utils.hashLength(cluster.workers) + " workers...", "warning");
          setTimeout(binary.loopUntilNoWorkers, loopSleep);
        }else{
          binary.log("all workers gone", "info");
          if(binary.clusterConfig.pidfile != null){
            try{ fs.unlinkSync(binary.clusterConfig.pidfile); }catch(e){ }
          }
          setTimeout(process.exit, 500);
        }
      }

      binary.loopUntilAllWorkers = function(){
        if(binary.utils.hashLength(cluster.workers) < binary.workersExpected){
          binary.startAWorker();
          setTimeout(binary.loopUntilAllWorkers, loopSleep);
        }
      }

      binary.reloadAWorker = function(next){
        var count = 0;
        for (var i in cluster.workers){ count++; }
        if(binary.workersExpected > count){
          binary.startAWorker();
        }
        if(binary.workerRestartArray.length > 0){
          var worker = binary.workerRestartArray.pop();
          worker.send("stopProcess");
        }
      }

      next();
    },
    process: function(next){
      process.stdin.resume();
      binary.workerRestartArray = []; // used to trask rolling restarts of workers
      binary.workersExpected = 0;

      // signals
      process.on('SIGINT', function(){
        binary.log("Signal: SIGINT", "debug");
        binary.workersExpected = 0;
        binary.setupShutdown();
      });
      process.on('SIGTERM', function(){
        binary.log("Signal: SIGTERM", "debug");
        binary.workersExpected = 0;
        binary.setupShutdown();
      });
      process.on('SIGUSR2', function(){
        binary.log("Signal: SIGUSR2", "debug");
        binary.log("swap out new workers one-by-one", "info");
        binary.workerRestartArray = [];
        for(var i in cluster.workers){
          binary.workerRestartArray.push(cluster.workers[i]);
        }
        binary.workerRestartArray.reverse();
        binary.reloadAWorker();
      });
      process.on('SIGHUP', function(){
        binary.log("Signal: SIGHUP", "debug");
        binary.log("reload all workers now", "info");
        for (var i in cluster.workers){
          var worker = cluster.workers[i];
          worker.send("restart");
        }
      });
      process.on('SIGWINCH', function(){
        if(binary.isDaemon){
          binary.log("Signal: SIGWINCH", "debug");
          binary.log("stop all workers", "info");
          binary.workersExpected = 0;
          for (var i in cluster.workers){
            var worker = cluster.workers[i];
            worker.send("stopProcess");
          }
        }
      });
      process.on('SIGTTIN', function(){
        binary.log("Signal: SIGTTIN", "debug");
        binary.log("add a worker", "info");
        binary.workersExpected++;
        binary.startAWorker();
      });
      process.on('SIGTTOU', function(){
        binary.log("Signal: SIGTTOU", "debug");
        binary.log("remove a worker", "info");
        binary.workersExpected--;
        for (var i in cluster.workers){
          var worker = cluster.workers[i];
          worker.send("stopProcess");
          break;
        }
      });
      process.on("exit", function(){
        binary.workersExpected = 0;
        binary.log("cluster complete, Bye!", 'notice')
      });

      if (process.platform === "win32"){
        var rl = readLine.createInterface ({
            input: process.stdin,
            output: process.stdout
        });
        rl.on("SIGINT", function (){
            process.emit ("SIGINT");
        });
      }
      
      next();
    },
    start: function(next){
      cluster.setupMaster({
        exec : binary.clusterConfig.exec,
        args: binary.clusterConfig.args.split(" "),
      });

      for (var i = 0; i < binary.clusterConfig.workers; i++) {
        binary.workersExpected++;
      }
      cluster.on('fork', function(worker) {
        binary.log("worker " + worker.process.pid + " (#"+worker.workerID+") has spawned", "info");
      });
      cluster.on('listening', function(worker, address) {
        //
      });
      cluster.on('exit', function(worker, code, signal) {
        binary.log("worker " + worker.process.pid + " (#"+worker.workerID+") has exited", "alert");
        binary.releaseWorkerId(worker.workerID);
        setTimeout(binary.reloadAWorker, loopSleep / 2); // to prevent CPU-splsions if crashing too fast
      });

      binary.loopUntilAllWorkers();
    }
  });

}