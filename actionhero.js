////////////////////////////////////////////////////////////////////////////
// actionhero Framework in node.js
// evan@evantahler.com
// https://github.com/evantahler/actionhero

var fs = require('fs');
var path = require('path');
var async = require('async');

var actionhero = function(){
  var self = this;
  self.initializers = {};
  self.api = {
    running: false,
    initialized: false,
    shuttingDown: false
  };
};

var configInitializers       = [];
var loadInitializers         = [];
var startInitializers        = [];
var stopInitializers         = [];

actionhero.prototype.initialize = function(params, callback){
  var self = this;
  self.api._self = self;
  self.api.commands = {
    initialize: self.initialize,
    start: self.start,
    stop: self.stop,
    restart: self.restart
  };

  self.api.projectRoot = process.cwd();
  if(process.env.project_root){
    self.api.projectRoot = process.env.project_root;
  } else if(process.env.projectRoot){
    self.api.projectRoot = process.env.projectRoot;
  } else if(process.env.PROJECT_ROOT){
    self.api.projectRoot = process.env.PROJECT_ROOT;
  }

  if(!callback && typeof params === 'function'){
    callback = params; params = {};
  }
  if(params === null){ params = {} }
  self.startingParams = params;
  self.api._startingParams = self.startingParams;

  self.api.initializerDefauls = {
    load:  1000,
    start: 1000,
    stop:  1000,
  }

  var loadInitializerRankings  = {};
  var startInitializerRankings = {};
  var stopInitializerRankings  = {};

  // we need to load the config first
  [
    path.resolve( __dirname + '/initializers/' + 'utils.js'        ),
    path.resolve( __dirname + '/initializers/' + 'configLoader.js' ),
  ].forEach(function(file){
    var filename = file.replace(/^.*[\\\/]/, '');
    var initializer = filename.split('.')[0];
    delete require.cache[require.resolve(file)];
    self.initializers[initializer] = require(file);
    configInitializers.push( function(next){
      self.initializers[initializer].initialize(self.api, next);
      self.api.watchFileAndAct(file, function(){
        self.api.log('\r\n\r\n*** rebooting due to initializer change (' + file + ') ***\r\n\r\n', 'info');
        self.api.commands.restart.call(self.api._self);
      });
    } );
  });

  configInitializers.push( function(){

    // load all other initializers based on thier name
    self.api.utils.arrayUniqueify(
      [
        __dirname + path.sep + 'initializers'
      ].concat(
        self.api.config.general.paths.initializer
      )
    ).forEach(function(dir){

      dir = path.normalize(dir);
      fs.readdirSync(dir).sort().forEach(function(f){
        var file = path.resolve(dir + '/' + f);
        var initializer = f.split('.')[0];
        var fileParts = file.split('.');
        var ext = fileParts[(fileParts.length - 1)];
        if(ext === 'js'){
          delete require.cache[require.resolve(file)];
          self.initializers[initializer] = require(file);

          var loadFunction = function(next){
            if(typeof self.initializers[initializer].initialize === 'function'){
              if(typeof self.api.log === 'function'){ self.api.log('loading initializer: ' + initializer, 'debug', file); }
              self.initializers[initializer].initialize(self.api, next);
              self.api.watchFileAndAct(file, function(){
                self.api.log('\r\n\r\n*** rebooting due to initializer change (' + file + ') ***\r\n\r\n', 'info');
                self.api.commands.restart.call(self.api._self);
              });
            }else{
              next();
            }
          };

          var startFunction = function(next){
            if(typeof self.initializers[initializer].start === 'function'){
              if(typeof self.api.log === 'function'){ self.api.log(' > start: ' + initializer, 'debug', file); }
              self.initializers[initializer].start(self.api, next);
            }else{
              next();
            }
          };

          var stopFunction = function(next){
            if(typeof self.initializers[initializer].stop === 'function'){
              if(typeof self.api.log === 'function'){ self.api.log(' > stop: ' + initializer, 'debug', file); }
              self.initializers[initializer].stop(self.api, next);
            }else{
              next();
            }
          };

          if(self.initializers[initializer].loadPriority === undefined){ 
            self.initializers[initializer].loadPriority = self.api.initializerDefauls.load;
          }
          if(self.initializers[initializer].startPriority === undefined){ 
            self.initializers[initializer].startPriority = self.api.initializerDefauls.start;
          }
          if(self.initializers[initializer].stopPriority === undefined){ 
            self.initializers[initializer].stopPriority = self.api.initializerDefauls.stop;
          }

          if( loadInitializerRankings[ self.initializers[initializer].loadPriority ] === undefined ){
            loadInitializerRankings[ self.initializers[initializer].loadPriority ] = [];
          }
          if( startInitializerRankings[ self.initializers[initializer].startPriority ] === undefined ){
            startInitializerRankings[ self.initializers[initializer].startPriority ] = [];
          }
          if( stopInitializerRankings[ self.initializers[initializer].stopPriority ] === undefined ){
            stopInitializerRankings[ self.initializers[initializer].stopPriority ] = [];
          }

          if(self.initializers[initializer].loadPriority > 0){
            loadInitializerRankings[  self.initializers[initializer].loadPriority  ].push( loadFunction );
          }

          if(self.initializers[initializer].startPriority > 0){
            startInitializerRankings[ self.initializers[initializer].startPriority ].push( startFunction );
          }

          if(self.initializers[initializer].stopPriority > 0){
            stopInitializerRankings[  self.initializers[initializer].stopPriority  ].push( stopFunction );
          }
        }
      });
    });

    // flatten all the ordered initializer methods
    loadInitializers  = flattenOrderedInitialzer(loadInitializerRankings);
    startInitializers = flattenOrderedInitialzer(startInitializerRankings);
    stopInitializers  = flattenOrderedInitialzer(stopInitializerRankings);

    loadInitializers.push( function(){
      process.nextTick(function(){
        self.api.initialized = true;
        callback(null, self.api);
      });
    } );

    async.series(loadInitializers);
  } );

  async.series(configInitializers);
};

actionhero.prototype.start = function(params, callback){
  var self = this;

  if(!callback && typeof params === 'function'){
    callback = params; params = {};
  }

  var start = function(){
    self.api.running = true;

    startInitializers.push(function(){
      self.api.bootTime = new Date().getTime();
      self.api.log('*** Server Started @ ' + self.api.utils.sqlDateTime() + ' ***', 'notice');
      callback(null, self.api);
    });

    async.series(startInitializers);
  }

  if(self.api.initialized === true){
    start()
  } else {
    self.initialize(params, function(){
      start();
    })
  }
}

actionhero.prototype.stop = function(callback){
  var self = this;
  if(self.api.running === true){
    self.api.shuttingDown = true;
    self.api.running = false;
    self.api.initialized = false;
    self.api.log('Shutting down open servers and stopping task processing', 'alert');

    var orderedStopper = {};
    [
      'tasks',
      'resque',
      'webServer',
      'webSocketServer',
      'socketServer'
    ].forEach(function(stopper){
      if(self.api[stopper] && typeof self.api[stopper]._stop === 'function'){
        (function(name) {
          orderedStopper[name] = function(next){
            self.api.log(' > stop: ' + name, 'debug');
            self.api[name]._stop(self.api, next);
          };
        })(stopper);
      }
    });

    for(var i in self.api){
      if(typeof self.api[i]._stop === 'function' && !orderedStopper[i]){
        (function(name) {
          orderedStopper[name] = function(next){
            self.api.log(' > stop: ' + name, 'debug');
            self.api[name]._stop(self.api, next);
          };
        })(i);
      }
    }

    orderedStopper._complete = function(){
      setTimeout(function(){
        self.api.unWatchAllFiles();
        self.api.pids.clearPidFile();
        self.api.log('The actionhero has been stopped', 'alert');
        self.api.log('***', 'debug');
        delete self.api.shuttingDown;
        if(typeof callback === 'function'){ callback(null, self.api) }
      }, 500);
    };

    async.series(orderedStopper);
  } else if(self.api.shuttingDown === true){
    // double sigterm; ignore it
  } else {
    self.api.log('Cannot shut down (not running any servers)', 'info');
    if(typeof callback === 'function'){ callback(null, self.api) }
  }
};

actionhero.prototype.restart = function(callback){
  var self = this;

  if(self.api.running === true){
    self.stop(function(){
      self.start(self.startingParams, function(err, api){
        api.log('actionhero restarted', 'notice');
        if(typeof callback === 'function'){ callback(null, self.api) }
      });
    });
  } else {
    self.start(self.startingParams, function(err, api){
      api.log('actionhero restarted', 'notice');
      if(typeof callback === 'function'){ callback(null, self.api) }
    });
  }
};

//

var flattenOrderedInitialzer = function(collection){
  var output = [];
  var keys = [];
  for(var key in collection){
    keys.push(key);
  }
  keys.sort();
  keys.forEach(function(key){
    collection[key].forEach(function(d){
      output.push(d);
    })
  });

  return output;
}

exports.actionheroPrototype = actionhero;
