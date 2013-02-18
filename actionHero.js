////////////////////////////////////////////////////////////////////////////
// actionHero Framweork in node.js
// evan@evantahler.com 
// https://github.com/evantahler/actionHero

var fs = require("fs");
var path = require("path");
var async = require('async');

// backwards compatibility for old node versions
fs.existsSync || (fs.existsSync = path.existsSync);
fs.exists || (fs.exists = path.exists);

var actionHero = function(){
  var self = this;
  self.initalizers = {};
  self.api = {};
  try{ self.api.domain = require("domain"); }catch(e){ }
};
  
  
actionHero.prototype.start = function(params, next){
  var self = this;
  self.api._self = self;
  self.api._commands = {
    start: self.start,
    stop: self.stop,
    restart: self.restart
  };

  if (params === null){ params = {}; }
  self.startingParams = params;

  var initializerFolders = [ 
    process.cwd() + "/initializers/", 
    __dirname + "/initializers/"
  ];
    
  var initializerMethods = [];
  for(var i in initializerFolders){
    var folder = initializerFolders[i];
    if(fs.existsSync(folder)){
      fs.readdirSync(folder).sort().forEach( function(file) {
        if (file[0] != "."){
          var initalizer = file.split(".")[0];
          if(require.cache[initializerFolders[i] + file] !== null){
            delete require.cache[initializerFolders[i] + file];
          }
          initializerMethods.push(initalizer);
          self.initalizers[initalizer] = require(initializerFolders[i] + file)[initalizer];
        }
      });
    }
  }

  // run the initializers
  var orderedInitializers = {};
  orderedInitializers['config'] = function(next){ self.initalizers['config'](self.api, self.startingParams, next) };
  [
    'utils',
    'id',
    'pids',
    'logger',
    'exceptions',
    'stats',
    'redis',
    'cache',
    'actions',
    'actionProcessor',
    'params',
    'fileServer',
    'chatRooms',
    'tasks',
    'task',
    'taskProcessor',
    'routes',
    'connections',
    'webServer', 
    'webSocketServer', 
    'socketServer'
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
    if(self.api.configData.general.developmentMode == true){
      self.api.log("running in development mode", "notice")
    }
    self.api.running = true;
    var starters = [];
    for(var i in self.api){
      if(typeof self.api[i]._start == "function"){
        starters.push(i);
      }
    }

    var started = 0;
    var successMessage = "*** Server Started @ " + self.api.utils.sqlDateTime() + " ***";
    if(starters.length == 0){
      self.api.bootTime = new Date().getTime();
      self.api.log("server ID: " + self.api.id, "notice");
      self.api.log(successMessage, "notice");
      if(next !== null){ 
        next(null, self.api);
      }
    }else{
      starters.forEach(function(starter){
        started++;
        self.api[starter]._start(self.api, function(){
          process.nextTick(function(){
            self.api.log(" > start: " + starter, 'debug');
            started--;
            if(started == 0){
              self.api.bootTime = new Date().getTime();
              self.api.log("server ID: " + self.api.id, "notice");
              self.api.log(successMessage, "notice");
              if(next !== null){ 
                next(null, self.api);
              }
            }
          });
        });
      });
    }
  };

  async.series(orderedInitializers);
};

actionHero.prototype.stop = function(next){ 
  var self = this;
  if(self.api.running === true){
    self.shuttingDown = true;
    self.api.running = false;
    self.api.log("Shutting down open servers and stopping task processing", "alert");

    var orderedTeardowns = {};
    var thing = [
      "webServer", 
      "webSocketServer", 
      "socketServer", 
      "taskProcessor"
    ]
    thing.forEach(function(terdown){
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
      delete self.shuttingDown;
      if(typeof next == "function"){ next(null, self.api); }
    };

    async.series(orderedTeardowns);
  }else if(self.shuttingDown === true){
    // double sigterm; ignore it
  }else{
    self.api.log("Cannot shut down (not running any servers)", "info");
    if(typeof next == "function"){ next(null, self.api); }
  }
};

actionHero.prototype.restart = function(next){
  var self = this;

  if(self.api.running === true){
    self.stop(function(err){
      self.start(self.startingParams, function(err, api){
        api.log('actionHero restarted', "notice");
        if(typeof next == "function"){ next(null, self.api); } 
      });
    });
  }else{
    self.start(self.startingParams, function(err, api){
      api.log('actionHero restarted', "notice");
      if(typeof next == "function"){ next(null, self.api); } 
    });
  }
};

exports.actionHeroPrototype = actionHero;