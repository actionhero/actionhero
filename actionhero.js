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

actionhero.prototype.initialize = function(params, callback){
  var self = this;
  self.api._self = self;
  self.api.commands = {
    initialize: self.initialize,
    start: self.start,
    stop: self.stop,
    restart: self.restart
  };

  self.api.project_root = process.cwd();
  if(process.env.project_root != null){
    self.api.project_root = process.env.project_root;
  } else if(process.env.PROJECT_ROOT != null){
    self.api.project_root = process.env.PROJECT_ROOT;
  }

  if(callback == null && typeof params == 'function'){
    callback = params; params = {};
  }
  if(params === null){ params = {} }
  self.startingParams = params;
  self.api._startingParams = self.startingParams;

  // run the initializers
  var orderedInitializers = {};

  [
    'utils',
    'configLoader',
    'id',
    'pids',
    'logger',
    'exceptions',
    'stats',
    'redis',
    'cache',
    'connections',
    'actions',
    'documentation',
    'actionProcessor',
    'params',
    'staticFile',
    'chatRoom',
    'resque',
    'tasks',
    'routes',
    'genericServer',
    'servers',
    'specHelper'
  ].forEach(function(initializer){
    var file = __dirname + '/initializers/' + initializer + '.js';
    delete require.cache[require.resolve(file)];
    self.initializers[initializer] = require(file)[initializer];
    orderedInitializers[initializer] = function(next){
      self.initializers[initializer](self.api, next);
      self.api.watchFileAndAct(file, function(){
        self.api.log('\r\n\r\n*** rebooting due to initializer change ('+file+') ***\r\n\r\n', 'info');
        self.api.commands.restart.call(self.api._self);
      });
    };
  });

  orderedInitializers['_projectInitializers'] = function(next){

    var projectInitializers = {};
  
    self.api.config.general.paths.initializer.forEach(function(initPath){
      if(path.resolve(initPath) != path.resolve(__dirname + '/initializers')){
        var localInitializerPath = path.resolve(initPath);
        if( fs.existsSync(localInitializerPath) ){
          var fileSet = fs.readdirSync(localInitializerPath).sort();
          fileSet.forEach(function(f){
            var file = path.resolve(initPath + '/' + f);
            if(file[0] != '.'){
              var initializer = f.split('.')[0];
              var fileParts = file.split('.');
              var ext = fileParts[(fileParts.length - 1)];
              if(ext === 'js'){
                if(require.cache[require.resolve(file)] !== null){
                  delete require.cache[require.resolve(file)];
                }
                self.initializers[initializer] = require(file)[initializer];
                projectInitializers[initializer] = function(next){
                  self.api.log('running custom initializer: ' + initializer, 'info');
                  self.initializers[initializer](self.api, next);
                  self.api.watchFileAndAct(file, function(){
                    self.api.log('\r\n\r\n*** rebooting due to initializer change (' + file + ') ***\r\n\r\n', 'info');
                    self.api.commands.restart.call(self.api._self);
                  });
                };
              }
            }
          });
        }else{
          self.api.log('local initializer path not found: ' + localInitializerPath, 'alert');
        }
      }
    })

    projectInitializers['_complete'] = function(){
      process.nextTick(function(){ next(); });
    }

    async.series(projectInitializers);
  }

  orderedInitializers['_complete'] = function(){
    self.api.initialized = true;
    callback(null, self.api);
  };

  async.series(orderedInitializers);
};

actionhero.prototype.start = function(params, callback){
  var self = this;

  if(callback == null && typeof params == 'function'){
    callback = params; params = {};
  }

  var start = function(){
    self.api.running = true;
    self._starters = [];
    for(var i in self.api){
      if(typeof self.api[i]._start == 'function'){
        self._starters.push(i);
      }
    }

    var started = 0;
    var successMessage = '*** Server Started @ ' + self.api.utils.sqlDateTime() + ' ***';
    if(self._starters.length == 0){
      self.api.bootTime = new Date().getTime();
      self.api.log('server ID: ' + self.api.id, 'notice');
      self.api.log(successMessage, 'notice');
      if(callback !== null){ callback(null, self.api); }
    } else {
      self._starters.forEach(function(starter){
        started++;
        self.api[starter]._start(self.api, function(){
          process.nextTick(function(){
            self.api.log(' > start: ' + starter,'debug');
            started--;
            if(started == 0){
              self.api.bootTime = new Date().getTime();
              self.api.log('server ID: ' + self.api.id, 'notice');
              self.api.log(successMessage, 'notice');
              if(callback !== null){ callback(null, self.api); }
            }
          });
        });
      });
    }
  }

  if(self.api.initialized === true){
    start()
  } else {
    self.initialize(params, function(err){
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
      if(self.api[stopper] != null && typeof self.api[stopper]._stop == 'function'){
        (function(name) {
          orderedStopper[name] = function(next){
            self.api.log(' > stop: ' + name, 'debug');
            self.api[name]._stop(self.api, next);
          };
        })(stopper);
      }
    });

    for(var i in self.api){
      if(typeof self.api[i]._stop == 'function' && orderedStopper[i] == null){
        (function(name) {
          orderedStopper[name] = function(next){
            self.api.log(' > stop: ' + name, 'debug');
            self.api[name]._stop(self.api, next);
          };
        })(i);
      }
    }

    orderedStopper['_complete'] = function(){
      setTimeout(function(){
        self.api.unWatchAllFiles();
        self.api.pids.clearPidFile();
        self.api.log('The actionhero has been stopped', 'alert');
        self.api.log('***', 'debug');
        delete self.api.shuttingDown;
        if(typeof callback == 'function'){ callback(null, self.api) }
      }, 500);
    };

    async.series(orderedStopper);
  } else if(self.api.shuttingDown === true){
    // double sigterm; ignore it
  } else {
    self.api.log('Cannot shut down (not running any servers)', 'info');
    if(typeof callback == 'function'){ callback(null, self.api) }
  }
};

actionhero.prototype.restart = function(callback){
  var self = this;

  if(self.api.running === true){
    self.stop(function(err){
      self.start(self.startingParams, function(err, api){
        api.log('actionhero restarted', 'notice');
        if(typeof callback == 'function'){ callback(null, self.api) }
      });
    });
  } else {
    self.start(self.startingParams, function(err, api){
      api.log('actionhero restarted', 'notice');
      if(typeof callback == 'function'){ callback(null, self.api) }
    });
  }
};

exports.actionheroPrototype = actionhero;
