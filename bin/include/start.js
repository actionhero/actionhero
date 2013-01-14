exports['start'] = function(binary, next){

  var cluster = require('cluster');
  var path = require('path');
    
  var actionHeroPrototype = require(path.join(binary.paths.actionHero_root, "actionHero.js")).actionHeroPrototype;
  var actionHero = new actionHeroPrototype();

  var shutdownTimeout = 10000 // number of ms to wait to do a forcible shutdown if actionHero won't stop gracefully

  var title = process.title;
  var api = {};

  // if there is no config.js file in the application's root, then actionHero will load in a collection of default params.
  // You can overwrite them with params.configChanges
  var params = {
    configChanges: {}
  };

  var startServer = function(next){
    if(cluster.isWorker){ process.send("starting"); }
    actionHero.start(params, function(err, api_from_callback){
      if(err){
        console.log(err);
        process.exit();
      }else{
        api = api_from_callback;
        api.log("Boot Sucessful @ pid #" + process.pid, "green");
        if(typeof next == "function"){
          if(cluster.isWorker){ process.send("started"); }
          next(api);
        }
      }
    });
  }

  var stopServer = function(next){
    actionHero.stop(function(err, api_from_callback){
      api = null;
      if(typeof next == "function"){ next(api); }
    });
  }

  var restartServer = function(next){
    actionHero.restart(function(err, api_from_callback){
      api = api_from_callback;
      if(typeof next == "function"){ next(api); }
    });
  }

  // handle posix signals
  process.on('SIGINT', function(){
    setTimeout(process.exit, shutdownTimeout);
    stopServer(function(){
      setTimeout(process.exit, 500);
    });
  });
  process.on('SIGTERM', function(){
    stopServer(function(){
      setTimeout(process.exit, 500);
    });
  });
  process.on('SIGKILL', function(){
    setTimeout(process.exit, shutdownTimeout);
    stopServer(function(){
      setTimeout(process.exit, 500);
    });
  });
  process.on('SIGUSR2', function(){
    restartServer();
  });

  // handle signals from master if running in cluster
  if(cluster.isWorker){
    process.on('message', function(msg) {
      if(msg == "start"){
        startServer(function(){ 
          //
        });
      }
      else if(msg == "stop"){
        process.send("stopping");
        stopServer(function(){
          process.send("stopped");
        })
      }
      else if(msg == "restart"){
        process.send("restarting");
        restartServer(function(){
          process.send("restarted");
        });
      }
    });
  }

  // start the server!
  startServer(function(api_from_callback){
    api = api_from_callback;
    api.log("Successfully Booted!", ["green", "bold"]);     
    next();
  });

}