////////////////////////////////////////////////////////////////////////////
// actionHero Framweork in node.js
// evan@evantahler.com 
// https://github.com/evantahler/actionHero

var fs = require("fs");
var path = require("path");
var async = require('async');

var actionHero = function(){
  var self = this;
  self.initalizers = {};
  self.api = {
    running: false,
    initialized: false,
    shuttingDown: false,
  };
};
  
actionHero.prototype.initialize = function(params, callback){
  var self = this;
  self.api._self = self;
  self.api._commands = {
    initialize: self.initialize,
    start: self.start,
    stop: self.stop,
    restart: self.restart
  };

  if (params === null){ params = {}; }
  self.startingParams = params;
  self.api._startingParams = self.startingParams;

  var initializerFolders = [ 
    __dirname + "/initializers/",
    process.cwd() + "/initializers/"
  ];
    
  var initializerMethods = [];
  for(var i in initializerFolders){
    var folder = initializerFolders[i];
    if(fs.existsSync(folder)){
      fs.readdirSync(folder).sort().forEach( function(file) {
        if (file[0] != "."){
          var initalizer = file.split(".")[0];
          var ext = file.split('.')[1];
          if (ext === 'js') {
            if(require.cache[require.resolve(initializerFolders[i] + file)] !== null){
              delete require.cache[require.resolve(initializerFolders[i] + file)];
            }
            initializerMethods.push(initalizer);
            self.initalizers[initalizer] = require(initializerFolders[i] + file)[initalizer];
          }
        }
      });
    }
  }

  // run the initializers
  var orderedInitializers = {};
  [
    'utils',
    'config',
    'id',
    'pids',
    'logger',
    'exceptions',
    'stats',
    'redis',
    'faye',
    'cache',
    'connections',
    'actions',
    'actionProcessor',
    'params',
    'staticFile',
    'chatRooms',
    'tasks',
    'task',
    'taskProcessor',
    'routes',
    'genericServer',
    'servers'
  ].forEach(function(I){
    orderedInitializers[I] = function(next){ self.initalizers[I](self.api, next) };
  });

  initializerMethods.forEach(function(method){
    if(typeof orderedInitializers[method] != "function"){
      orderedInitializers[method] = function(next){ 
        self.api.log("running custom initalizer: " + method, "info");
        self.initalizers[method](self.api, next);
      };
    }
  });

  orderedInitializers['_complete'] = function(){ 
    self.api.initialized = true;
    callback(null, self.api);
  };

  async.series(orderedInitializers);
};

actionHero.prototype.start = function(params, callback){
  var self = this;

  var start = function(){
    if(self.api.configData.general.developmentMode == true){
      self.api.log("running in development mode", "notice")
    }
    self.api.running = true;
    self._starters = [];
    for(var i in self.api){
      if(typeof self.api[i]._start == "function"){
        self._starters.push(i);
      }
    }

    var started = 0;
    var successMessage = "*** Server Started @ " + self.api.utils.sqlDateTime() + " ***";
    if(self._starters.length == 0){
      self.api.bootTime = new Date().getTime();
      self.api.log("server ID: " + self.api.id, "notice");
      self.api.log(successMessage, "notice");
      if(callback !== null){ callback(null, self.api); }
    }else{
      self._starters.forEach(function(starter){
        started++;
        self.api[starter]._start(self.api, function(){
          process.nextTick(function(){
            self.api.log(" > start: " + starter, 'debug');
            started--;
            if(started == 0){
              self.api.bootTime = new Date().getTime();
              self.api.log("server ID: " + self.api.id, "notice");
              self.api.log(successMessage, "notice");
              if(callback !== null){ callback(null, self.api); }
            }
          });
        });
      });
    }
  }

  if(self.api.initialized === true){
    start()
  }else{
    self.initialize(params, function(err){
      start();
    })
  }
}

actionHero.prototype.stop = function(callback){ 
  var self = this;
  if(self.api.running === true){
    self.api.shuttingDown = true;
    self.api.running = false;
    self.api.initialized = false;
    self.api.log("Shutting down open servers and stopping task processing", "alert");

    var orderedTeardowns = {};
    [
      "webServer", 
      "faye", 
      "webSocketServer", 
      "socketServer", 
      "taskProcessor"
    ].forEach(function(terdown){
      if(self.api[terdown] != null && typeof self.api[terdown]._teardown == "function"){
        (function(name) {
          orderedTeardowns[name] = function(next){ 
            self.api.log(" > teardown: " + name, 'debug');
            self.api[name]._teardown(self.api, next); 
          };
        })(terdown);
      }
    });

    for(var i in self.api){
      if(typeof self.api[i]._teardown == "function" && orderedTeardowns[i] == null){
        (function(name) {
          orderedTeardowns[name] = function(next){ 
            self.api.log(" > teardown: " + name, 'debug');
            self.api[name]._teardown(self.api, next); 
          };
        })(i);
      }
    }

    orderedTeardowns['_complete'] = function(){ 
      for(var i in self.api.watchedFiles){
        fs.unwatchFile(self.api.watchedFiles[i]);
      }
      self.api.pids.clearPidFile();
      self.api.log("The actionHero has been stopped", "alert");
      self.api.log("***", "debug");
      delete self.api.shuttingDown;
      if(typeof callback == "function"){ callback(null, self.api); }
    };

    async.series(orderedTeardowns);
  }else if(self.api.shuttingDown === true){
    // double sigterm; ignore it
  }else{
    self.api.log("Cannot shut down (not running any servers)", "info");
    if(typeof callback == "function"){ callback(null, self.api); }
  }
};

actionHero.prototype.restart = function(callback){
  var self = this;

  if(self.api.running === true){
    self.stop(function(err){
      self.start(self.startingParams, function(err, api){
        api.log('actionHero restarted', "notice");
        if(typeof callback == "function"){ callback(null, self.api); } 
      });
    });
  }else{
    self.start(self.startingParams, function(err, api){
      api.log('actionHero restarted', "notice");
      if(typeof callback == "function"){ callback(null, self.api); } 
    });
  }
};

exports.actionHeroPrototype = actionHero;