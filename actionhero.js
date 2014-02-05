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
  
  self.api.watchFileAndAct = function(){};
  
  //Shim until logger is loaded, will log to console if thrown during loading of core initializers
  self.api.log = function(a,b){
      if(["warning","error","crit","alert","emerg"].indexOf(b)>-1)
      console.log(a+" "+b);
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
      
      var defaultWFAACallback = function(){
          var cleanPath = fullFilePath;
          if(process.platform === 'win32'){
            cleanPath = fullFilePath.replace(/\//g, '\\');
          }

          delete require.cache[require.resolve(cleanPath)];
          that.loadFile(fullFilePath, true);
          try{
          self.api.params.buildPostVariables();
          }catch(e){
            self.api.log(e,'emerg');
          }
      };
        
      self.api.watchFileAndAct(fullFilePath, function(){   
        if(that.watchFileAndActCallback){
          that.watchFileAndActCallback();
        }else{
          var cleanPath = fullFilePath;
          if(process.platform === 'win32'){
            cleanPath = fullFilePath.replace(/\//g, '\\');
          }

          delete require.cache[require.resolve(cleanPath)];
          that.loadFile(fullFilePath, true);
          try{
          self.api.params.buildPostVariables();
          }catch(e){
            self.api.log(e,'emerg');
          }
        }
      });
      
      try {
        
        var collection = require(fullFilePath);
        for(var i in collection){
          
          var _module = collection[i];
          that.fileHandler(collection[i], reload, fullFilePath);

          var module_name = collection[i].name || path.basename(fullFilePath);
          
          self.api.log('file ' + (reload?'(re)':'') + 'loaded: ' + module_name + ', ' + fullFilePath, 'debug');
        
        }
      } catch(err){

        that.exceptionManager(fullFilePath, err, _module);
      }
    };

  self.api.common_loader.prototype.loadDirectory = function(path, fileList){
    var that = this;
    
    var readList = (fileList)?fileList:fs.readdirSync(path);
    readList.forEach( function(file) {
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
  
  self.api.common_loader.prototype.initialize = function(path, fileList){
    var that = this;
    if(!fs.existsSync(path)){
      self.api.log("Failed to load initializer for: "+path+", path invalid.", "warning");
    }else{
      that.loadDirectory(path, fileList);
    } 
  };
    
  // run the initializers
  var Initializers = new self.api.common_loader;
 
  Initializers.fileHandler = function(initializer, reload, fullFilePath){
    
    //This needs to be explicit somewhere in a standardized part of the documentation
    var initname = path.basename(fullFilePath).split('.')[0];
    self.initalizers[initname] = initializer;
    this.prepArray[initname] = function(next){
      self.initalizers[initname](self.api, next);
    };
  };
  
  Initializers.watchFileAndActCallback = function(file){
    self.api.log('\r\n\r\n*** rebooting due to initializer change ('+file+') ***\r\n\r\n', 'info');
    self.api._commands.restart.call(self.api._self);
  };
  
  Initializers.initialize = function(paths){
    var that = this;
    that.prepArray = {};
    for(i=0;i<paths.length;i++){
    
    var path = paths[i][0];
    var fileList = paths[i][1];
    
      if(!fs.existsSync(path)){
        self.api.log("Failed to load initializer for: "+path+", path invalid.", "warning");
      }else{
        that.loadDirectory(path, fileList);  
      }
    }
    that.prepArray['_complete'] = function(){
      self.api.initialized = true;
      callback(null, self.api);
    }
    async.series(that.prepArray);
  };
  
  Initializers.exceptionManager = function(fullFilePath, err, initializer){
    console.log("Initializer at: "+fullFilePath+" could not be loaded, exiting");
    return null;
  };
  
  Initializers.initialize([[__dirname + '/initializers/core/',[
    'utils.js',
    'configLoader.js',
    'id.js',
    'pids.js',
    'logger.js',
    'exceptions.js',
    'stats.js',
    'redis.js',
    'faye.js',
    'cache.js',
    'connections.js',
    'actions.js',
    'documentation.js',
    'actionProcessor.js',
    'params.js',
    'staticFile.js',
    'chatRoom.js',
    'resque.js',
    'tasks.js',
    'routes.js',
    'genericServer.js',
    'servers.js',
    'specHelper.js'
  ]],[__dirname + '/initializers/project/']]);

  
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

