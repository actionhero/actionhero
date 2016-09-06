'use strict';

var cluster = require('cluster');
var readline = require('readline');
var os = require('os');

exports.start = function(binary, next){
  var ActionheroPrototype = require(binary.actionheroRoot + '/actionhero.js').actionheroPrototype;
  var actionhero = new ActionheroPrototype();

  // number of ms to wait to do a forcible shutdown if actionhero won't stop gracefully
  var shutdownTimeout = 1000 * 30;
  if(process.env.ACTIONHERO_SHUTDOWN_TIMEOUT){
    shutdownTimeout = parseInt(process.env.ACTIONHERO_SHUTDOWN_TIMEOUT);
  }

  var api = {};
  var state;

  var startServer = function(callback){
    state = 'starting';
    if(cluster.isWorker){ process.send({state: state}); }
    actionhero.start(function(error, apiFromCallback){
      if(error){
        binary.log(error);
        process.exit(1);
      }else{
        state = 'started';
        if(cluster.isWorker){ process.send({state: state}); }
        api = apiFromCallback;
        checkForInernalStop();
        if(typeof callback === 'function'){ callback(null, api); }
      }
    });
  };

  var stopServer = function(callback){
    state = 'stopping';
    if(cluster.isWorker){ process.send({state: state}); }
    actionhero.stop(function(){
      state = 'stopped';
      if(cluster.isWorker){ process.send({state: state}); }
      api = null;
      if(typeof callback === 'function'){ callback(null, api); }
    });
  };

  var restartServer = function(callback){
    state = 'restarting';
    if(cluster.isWorker){ process.send({state: state}); }
    actionhero.restart(function(error, apiFromCallback){
      if(error){ throw(error); }

      state = 'started';
      if(cluster.isWorker){ process.send({state: state}); }
      api = apiFromCallback;
      if(typeof callback === 'function'){ callback(null, api); }
    });
  };

  var stopProcess = function(){
    setTimeout(function(){
      throw new Error('process stop timeout reached.  terminating now.');
    }, shutdownTimeout);
    // finalTimer.unref();
    stopServer(function(){
      process.nextTick(function(){
        process.exit();
      });
    });
  };

  var checkForInernalStopTimer;
  var checkForInernalStop = function(){
    clearTimeout(checkForInernalStopTimer);
    if(actionhero.api.running !== true && state === 'started'){
      process.exit(0);
    }
    checkForInernalStopTimer = setTimeout(checkForInernalStop, shutdownTimeout);
  };

  if(cluster.isWorker){
    process.on('message', function(msg){
      if(msg === 'start'){ startServer(); }
      else if(msg === 'stop'){ stopServer(); }
      else if(msg === 'stopProcess'){ stopProcess(); }
      // in cluster, we cannot re-bind the port
      // so kill this worker, and then let the cluster start a new worker
      else if(msg === 'restart'){ stopProcess(); }
    });

    process.on('uncaughtException', function(error){
      var stack;
      try{
        stack = error.stack.split(os.EOL);
      }catch(e){
        stack = [error];
      }
      process.send({uncaughtException: {
        message: error.message,
        stack: stack
      }});
      process.nextTick(process.exit);
    });

    process.on('unhandledRejection', function(reason, p){
      process.send({unhandledRejection: {reason:reason, p:p}});
      process.nextTick(process.exit);
    });
  }

  process.on('SIGINT', function(){ stopProcess(); });
  process.on('SIGTERM', function(){ stopProcess(); });
  process.on('SIGUSR2', function(){ restartServer(); });

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
  startServer(function(){
    next(false);
  });
};
