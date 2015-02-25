var cluster = require('cluster');
var readline = require('readline');

exports.start = function(binary, next){

  var ActionheroPrototype = require(binary.paths.actionheroRoot + '/actionhero.js').actionheroPrototype;
  // var actionheroPrototype = require('./../../actionhero.js').actionheroPrototype;
  var actionhero = new ActionheroPrototype();
  // number of ms to wait to do a forcible shutdown if actionhero won't stop gracefully
  var shutdownTimeout = process.env.ACTIONHERO_SHUTDOWN_TIMEOUT || 1000 * 30 
  var api = {};
  var state;

  var startServer = function(next){
    state = 'starting';
    if(cluster.isWorker){ process.send(state); }
    actionhero.start(function(err, apiFromCallback){
      if(err){
        binary.log(err);
        process.exit(1);
      } else {
        state = 'started';
        if(cluster.isWorker){ process.send(state); }
        api = apiFromCallback;
        if(typeof next === 'function'){
          next(api);
        }
      }
    });
  }

  var stopServer = function(next){
    state = 'stopping';
    if(cluster.isWorker){ process.send(state); }
    actionhero.stop(function(){
      state = 'stopped';
      if(cluster.isWorker){ process.send(state); }
      api = null;
      if(typeof next === 'function'){ next(api); }
    });
  }

  var restartServer = function(next){
    state = 'restarting';
    if(cluster.isWorker){ process.send(state); }
    actionhero.restart(function(err, apiFromCallback){
      state = 'restarted';
      if(cluster.isWorker){ process.send(state); }
      api = apiFromCallback;
      if(typeof next === 'function'){ next(api); }
    });
  }

  var stopProcess = function(){
    setTimeout(function(){
      process.exit(1);
    }, shutdownTimeout)
    // finalTimer.unref();
    stopServer(function(){
      process.nextTick(function(){
        process.exit();
      });
    });
  }

  if(cluster.isWorker){
    process.on('message', function(msg){
      if(msg === 'start'){ startServer() }
      else if(msg === 'stop'){ stopServer() }
      else if(msg === 'stopProcess'){ stopProcess() }
      else if(msg === 'restart'){ restartServer() }
    });
  }
  process.on('SIGINT', function(){ stopProcess() });
  process.on('SIGTERM', function(){ stopProcess() });
  process.on('SIGUSR2', function(){ restartServer() });

  if(process.platform === 'win32' && !process.env.IISNODE_VERSION){
    var rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    rl.on('SIGINT', function(){
      process.emit('SIGINT');
    });
  }

  // start the server!
  startServer(next);
}
