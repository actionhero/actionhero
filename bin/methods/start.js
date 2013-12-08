var cluster = require('cluster');
var readline = require('readline');

exports['start'] = function(binary, next){

  var actionHeroPrototype = require(binary.paths.actionHero_root + '/actionHero.js').actionHeroPrototype;
  var actionHero = new actionHeroPrototype();
  var shutdownTimeout = 1000 * 30 // number of ms to wait to do a forcible shutdown if actionHero won't stop gracefully
  var api = {};
  var state;

  var startServer = function(next){
    state = 'starting';
    if(cluster.isWorker){ process.send(state); }
    actionHero.start(function(err, api_from_callback){
      if(err){
        if(cluster.isWorker){ process.send('failed_to_boot'); }
        binary.log(err);
        process.exit();
      } else {
        state = 'started';
        if(cluster.isWorker){ process.send(state); }
        api = api_from_callback;
        if(typeof next == 'function'){
          next(api);
        }
      }
    });
  }

  var stopServer = function(next){
    state = 'stopping';
    if(cluster.isWorker){ process.send(state); }
    actionHero.stop(function(err, api_from_callback){
      state = 'stopped';
      if(cluster.isWorker){ process.send(state); }
      api = null;
      if(typeof next == 'function'){ next(api); }
    });
  }

  var restartServer = function(next){
    state = 'restarting';
    if(cluster.isWorker){ process.send(state); }
    actionHero.restart(function(err, api_from_callback){
      state = 'restarted';
      if(cluster.isWorker){ process.send(state); }
      api = api_from_callback;
      if(typeof next == 'function'){ next(api); }
    });
  }

  var stopProcess = function(){
    if(state == 'started'){
      var finalTimer = setTimeout(process.exit, shutdownTimeout)
      // finalTimer.unref();
      stopServer(function(){
        process.nextTick(function(){
          process.exit();
        });
      });
    }
  }

  if(cluster.isWorker){
    process.on('message', function(msg){
      if(msg == 'start'){ startServer() }
      else if(msg == 'stop'){ stopServer() }
      else if(msg == 'stopProcess'){ stopProcess() }
      else if(msg == 'restart'){ restartServer() }
    });
  }
  process.on('SIGINT', function(){ stopProcess() });
  process.on('SIGTERM', function(){ stopProcess() });
  process.on('SIGUSR2', function(){ restartServer() });

  if(process.platform === 'win32'){
    var rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    rl.on('SIGINT', function(){
      process.emit('SIGINT');
    });
  }

  // start the server!
  startServer(function(api_from_callback){
    api = api_from_callback;
    next();
  });

}
