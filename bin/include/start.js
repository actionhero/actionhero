exports['start'] = function(binary, next){

  var cluster = require('cluster');
  var actionHeroPrototype = require(binary.paths.actionHero_root + "/actionHero.js").actionHeroPrototype;
  var actionHero = new actionHeroPrototype();
  var shutdownTimeout = 1000 * 60 // number of ms to wait to do a forcible shutdown if actionHero won't stop gracefully
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
          setTimeout(process.exit, 500);
        })
      }
      else if(msg == "restart"){
        process.send("restarting");
        restartServer(function(){
          process.send("restarted");
        });
      }
    });
    process.on('SIGINT', function(){}); // catch to ignore
  }else{
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
  }

  // start the server!
  startServer(function(api_from_callback){
    api = api_from_callback;
    next();
  });

}