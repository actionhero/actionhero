////////////////////////////////////////////////////////////////////////////
// actionhero Framework in node.js
// evan@evantahler.com 
// https://github.com/evantahler/actionhero

var fs = require('fs');
var path = require('path');
var async = require('async');

var actionhero = function(){
  var self = this;
  self.initalizers = {};
  self.api = {
    running: false,
    initialized: false,
    shuttingDown: false
  };
};
  
actionhero.prototype.initialize = function(params, callback){
  var self = this;
  self.api._self = self;
  self.api._commands = {
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

  self.api.common_loader = function(){};
 
  self.api.common_loader.prototype.loadFile = function(fullFilePath, reload){
      var that = this;
      if(reload == null){ reload = false; }
      
      self.api.watchFileAndAct(fullFilePath, function(){
        var cleanPath = fullFilePath;
        if(process.platform === 'win32'){
          cleanPath = fullFilePath.replace(/\//g, '\\');
        }

        delete require.cache[require.resolve(cleanPath)];
        that.loadFile(fullFilePath, true);
        try{
        self.api.params.buildPostVariables();
        }catch(e){
          console.log(e);
        }
      });
      
      try {
        var collection = require(fullFilePath);
        for(var i in collection){
          var _module = collection[i];
          that.fileHandler(collection[i], reload);

          self.api.log('file ' + (reload?'(re)':'') + 'loaded: ' + collection[i].name + ', ' + fullFilePath, 'debug');
        
        }
      } catch(err){

        that.exceptionManager(fullFilePath, err, _module);
      }
    };

  self.api.common_loader.prototype.loadDirectory = function(path){
    var that = this;
    
    fs.readdirSync(path).forEach( function(file) {
      if(path[path.length - 1] != '/'){ path += '/' }
      var fullFilePath = path + file;
      if(file[0] != '.'){
        var stats = fs.statSync(fullFilePath);
        if(stats.isDirectory()){

          that.loadDirectory(fullFilePath);
        } else if(stats.isSymbolicLink()){
          var realPath = fs.readlinkSync(fullFilePath);
          that.loadDirectory(realPath);
        } else if(stats.isFile()){
          var fileParts = file.split('.');
          var ext = fileParts[(fileParts.length - 1)];
          if(ext === 'js'){ that.loadFile(fullFilePath) }
        } else {
          self.api.log(file + ' is a type of file I cannot read', 'error')
        }
      }
    });
  };
      
  self.api.common_loader.prototype._validate = function(module, map){
    
    var fail = function(){
      self.api.log(module.name+" attribute: "+x+" is invalid." + '; exiting.', 'emerg');
      return false;
    }
  
    for(x in map){
      if(typeof map[x] == 'function'){
        if(map[x](module)){
          return fail();
        }
      }else if(typeof module[x] != map[x]){
         return fail();
      }
    };
    return true;
  };
  
  self.api.common_loader.prototype.initialize = function(path){
    var that = this;
    if(!fs.existsSync(path)){
      self.api.log("Failed to load initializer for: "+path+", path invalid.", "warning");
    }else{
      that.loadDirectory(path);
    } 
  };
    
  
  
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
    'faye',
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
    self.initalizers[initializer] = require(file)[initializer];
    orderedInitializers[initializer] = function(next){
      self.initalizers[initializer](self.api, next);
      self.api.watchFileAndAct(file, function(){
        self.api.log('\r\n\r\n*** rebooting due to initializer change ('+file+') ***\r\n\r\n', 'info');
        self.api._commands.restart.call(self.api._self);
      });
    };
  });

  orderedInitializers['_projectInitializers'] = function(next){
    var projectInitializers = {};
    if(path.resolve(self.api.config.general.paths.initializer) != path.resolve(__dirname + '/initializers')){
      var fileSet = fs.readdirSync(path.resolve(self.api.config.general.paths.initializer)).sort();
      fileSet.forEach(function(f){
        var file = path.resolve(self.api.config.general.paths.initializer + '/' + f);
        if(file[0] != '.'){
          var initializer = f.split('.')[0];
          var fileParts = file.split('.');
          var ext = fileParts[(fileParts.length - 1)];
          if(ext === 'js'){
            if(require.cache[require.resolve(file)] !== null){
              delete require.cache[require.resolve(file)];
            }
            self.initalizers[initializer] = require(file)[initializer];
            projectInitializers[initializer] = function(next){
              self.api.log('running custom initializer: ' + initializer, 'info');
              self.initalizers[initializer](self.api, next);
              self.api.watchFileAndAct(file, function(){
                self.api.log('\r\n\r\n*** rebooting due to initializer change (' + file + ') ***\r\n\r\n', 'info');
                self.api._commands.restart.call(self.api._self);
              });
            };
          }
        }
      });
    }

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
    if(self.api.config.general.developmentMode == true){
      self.api.log('running in development mode', 'notice')
    }
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
      'task',
      'resque',
      'webServer',
      'faye',
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
      self.api.unWatchAllFiles();
      self.api.pids.clearPidFile();
      self.api.log('The actionhero has been stopped', 'alert');
      self.api.log('***', 'debug');
      delete self.api.shuttingDown;
      if(typeof callback == 'function'){ callback(null, self.api) }
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
