exports['start'] = function(binary, next){

  var cluster = require('cluster');
  var actionHeroPrototype = require(binary.paths.actionHero_root + "/actionHero.js").actionHeroPrototype;
  var actionHero = new actionHeroPrototype();
  var shutdownTimeout = 1000 * 10 // number of ms to wait to do a forcible shutdown if actionHero won't stop gracefully
  var api = {};

  // if there is no config.js file in the application's root, then actionHero will load in a collection of default params.
  // You can overwrite them with params.configChanges
  var params = {
    configChanges: {}
  };

  var startServer = function(next){
    actionHero.start(params, function(err, api_from_callback){
      if(err){
        console.log(err);
        process.exit();
      }else{
        api = api_from_callback;
        if(typeof next == "function"){
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

  var stopProcess = function(callback){
    var finalTimer = setTimeout(process.exit, shutdownTimeout).unref();
    stopServer(function(){
      if(typeof callback == "function"){ callback(); }
      process.nextTick(function(){
        process.exit();
      });
    });
  }

  if(cluster.isWorker){
    process.on('message', function(msg) {
      if(msg == "start"){
        process.send("starting");
        startServer(function(){ 
          process.send("started");
        });
      }
      else if(msg == "stop"){
        process.send("stopping");
        stopProcess(function(){
          process.send("stopped");
        });
      }
      else if(msg == "restart"){
        process.send("restarting");
        restartServer(function(){
          process.send("restarted");
        });
      }
    });
  }else{
    process.on('SIGINT', function(){
      stopProcess();
    });
    process.on('SIGTERM', function(){
      stopProcess();
    });
    process.on('SIGUSR2', function(){
      restartServer();
    });
  }

  if (process.platform === "win32"){
    var rl = binary.readLine.createInterface ({
        input: process.stdin,
        output: process.stdout
    });
    rl.on("SIGINT", function (){
        process.emit ("SIGINT");
    });
  }

  // start the server!
  startServer(function(api_from_callback){
    api = api_from_callback;
    next();
  });

}