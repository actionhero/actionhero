'use strict';

////////////////////////////////////////////////////////////////////////////
// actionhero framework in node.js
// http://www.actionherojs.com
// https://github.com/evantahler/actionhero

var path = require('path');
var async = require('async');

// HELPERS ///

var fatalError = function(api, errors, type){
  if(errors && !(errors instanceof Array)){ errors = [errors]; }
  if(errors){
    if(api.log){
      api.log(['Error with initializer step: %s', type], 'emerg');
      errors.forEach(function(error){ api.log(error.stack, 'emerg'); });
    }else{
      console.error('Error with initializer step: ' + type);
      errors.forEach(function(error){ console.error(error.stack); });
    }
    api.commands.stop.call(api, function(){
      process.exit(1);
    });
  }
};

var sortNumber = function(a, b){
  return a - b;
};

var flattenOrderedInitialzer = function(collection){
  var output = [];
  var keys = [];
  for(var key in collection){
    keys.push(parseInt(key));
  }
  keys.sort(sortNumber);
  keys.forEach(function(key){
    collection[key].forEach(function(d){
      output.push(d);
    });
  });

  return output;
};

// ACTIONHERO //

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
  if(this._self){ self = this._self; }

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
  }else if(process.env.projectRoot){
    self.api.projectRoot = process.env.projectRoot;
  }else if(process.env.PROJECT_ROOT){
    self.api.projectRoot = process.env.PROJECT_ROOT;
  }

  if(!callback && typeof params === 'function'){
    callback = params; params = {};
  }
  if(params === null){ params = {}; }
  self.startingParams = params;
  self.api._startingParams = self.startingParams;

  self.api.initializerDefaults = {
    load:  1000,
    start: 1000,
    stop:  1000
  };

  var loadInitializerRankings  = {};
  var startInitializerRankings = {};
  var stopInitializerRankings  = {};

  self.configInitializers = [];
  self.loadInitializers   = [];
  self.startInitializers  = [];
  self.stopInitializers   = [];

  // we need to load the config first
  [
    path.resolve(__dirname + '/initializers/' + 'utils.js'),
    path.resolve(__dirname + '/initializers/' + 'config.js'),
  ].forEach(function(file){
    var filename = file.replace(/^.*[\\\/]/, '');
    var initializer = filename.split('.')[0];
    delete require.cache[require.resolve(file)];
    self.initializers[initializer] = require(file);
    self.configInitializers.push(function(next){
      self.initializers[initializer].initialize(self.api, next);
    });
  });

  self.configInitializers.push(function(){
    var customInitializers = [];
    self.api.config.general.paths.initializer.forEach(function(startPath){
      customInitializers = customInitializers.concat(self.api.utils.recursiveDirectoryGlob(startPath));
    });
    // load all other initializers
    self.api.utils.arrayUniqueify(
      self.api.utils.recursiveDirectoryGlob(__dirname + path.sep + 'initializers')
      .sort()
      .concat(
        customInitializers
        .sort()
      )
    ).forEach(function(f){
      var file = path.normalize(f);
      var initializer = path.basename(f).split('.')[0];
      var fileParts = file.split('.');
      var ext = fileParts[(fileParts.length - 1)];
      if(ext === 'js'){
        delete require.cache[require.resolve(file)];
        self.initializers[initializer] = require(file);

        var loadFunction = function(next){
          self.api.watchFileAndAct(file, function(){
            self.api.log(['*** Rebooting due to initializer change (%s) ***', file], 'info');
            self.api.commands.restart.call(self.api._self);
          });

          if(typeof self.initializers[initializer].initialize === 'function'){
            if(typeof self.api.log === 'function'){ self.api.log(['Loading initializer: %s', initializer], 'debug', file); }
            self.initializers[initializer].initialize(self.api, function(error){
              try{ self.api.log(['Loaded initializer: %s', initializer], 'debug', file); }catch(e){ }
              next(error);
            });
          }else{
            next();
          }
        };

        var startFunction = function(next){
          if(typeof self.initializers[initializer].start === 'function'){
            if(typeof self.api.log === 'function'){ self.api.log(['Starting initializer: %s', initializer], 'debug', file); }
            self.initializers[initializer].start(self.api, function(error){
              self.api.log(['Started initializer: %s', initializer], 'debug', file);
              next(error);
            });
          }else{
            next();
          }
        };

        var stopFunction = function(next){
          if(typeof self.initializers[initializer].stop === 'function'){
            if(typeof self.api.log === 'function'){ self.api.log(['Stopping initializer: %s', initializer], 'debug', file); }
            self.initializers[initializer].stop(self.api, function(error){
              self.api.log(['Stopped initializer: %s', initializer], 'debug', file);
              next(error);
            });
          }else{
            next();
          }
        };

        if(self.initializers[initializer].loadPriority === undefined){
          self.initializers[initializer].loadPriority = self.api.initializerDefaults.load;
        }
        if(self.initializers[initializer].startPriority === undefined){
          self.initializers[initializer].startPriority = self.api.initializerDefaults.start;
        }
        if(self.initializers[initializer].stopPriority === undefined){
          self.initializers[initializer].stopPriority = self.api.initializerDefaults.stop;
        }

        if(loadInitializerRankings[self.initializers[initializer].loadPriority] === undefined){
          loadInitializerRankings[self.initializers[initializer].loadPriority] = [];
        }
        if(startInitializerRankings[self.initializers[initializer].startPriority] === undefined){
          startInitializerRankings[self.initializers[initializer].startPriority] = [];
        }
        if(stopInitializerRankings[self.initializers[initializer].stopPriority] === undefined){
          stopInitializerRankings[self.initializers[initializer].stopPriority] = [];
        }

        if(self.initializers[initializer].loadPriority > 0){
          loadInitializerRankings[self.initializers[initializer].loadPriority].push(loadFunction);
        }

        if(self.initializers[initializer].startPriority > 0){
          startInitializerRankings[self.initializers[initializer].startPriority].push(startFunction);
        }

        if(self.initializers[initializer].stopPriority > 0){
          stopInitializerRankings[self.initializers[initializer].stopPriority].push(stopFunction);
        }
      }
    });

    // flatten all the ordered initializer methods
    self.loadInitializers  = flattenOrderedInitialzer(loadInitializerRankings);
    self.startInitializers = flattenOrderedInitialzer(startInitializerRankings);
    self.stopInitializers  = flattenOrderedInitialzer(stopInitializerRankings);

    self.loadInitializers.push(function(){
      process.nextTick(function(){
        self.api.initialized = true;
        callback(null, self.api);
      });
    });

    async.series(self.loadInitializers, function(errors){ fatalError(self.api, errors, 'initialize'); });
  });

  async.series(self.configInitializers, function(errors){ fatalError(self.api, errors, 'config'); });
};

actionhero.prototype.start = function(params, callback){
  var self = this;
  if(this._self){ self = this._self; }

  if(!callback && typeof params === 'function'){
    callback = params; params = {};
  }

  var _start = function(){
    self.api.running = true;

    if(self.startInitializers[(self.startInitializers.length - 1)].name === 'finalStartInitializer'){
      self.startInitializers.pop();
    }

    self.startInitializers.push(function finalStartInitializer(){
      self.api.bootTime = new Date().getTime();
      self.api.log(['*** ActionHero Started ***'], 'notice');
      callback(null, self.api);
    });

    async.series(self.startInitializers, function(errors){ fatalError(self.api, errors, 'start'); });
  };

  if(self.api.initialized === true){
    _start();
  }else{
    self.initialize(params, function(){
      _start();
    });
  }
};

actionhero.prototype.stop = function(callback){
  var self = this;
  if(this._self){ self = this._self; }

  if(self.api.running === true){
    self.api.shuttingDown = true;
    self.api.running = false;
    self.api.initialized = false;

    self.api.log('Shutting down open servers and stopping task processing...', 'alert');

    if(self.stopInitializers[(self.stopInitializers.length - 1)].name === 'finalStopInitializer'){
      self.stopInitializers.pop();
    }

    self.stopInitializers.push(function finalStopInitializer(){
      self.api.unWatchAllFiles();
      self.api.pids.clearPidFile();
      self.api.log('*** ActionHero Stopped ***', 'alert');
      self.api.log('***', 'debug');
      delete self.api.shuttingDown;
      process.nextTick(function(){
        if(typeof callback === 'function'){ callback(null, self.api); }
      });
    });

    async.series(self.stopInitializers, function(errors){ fatalError(self.api, errors, 'stop'); });
  }else if(self.api.shuttingDown === true){
    // double sigterm; ignore it
  }else{
    if(self.api.log){ self.api.log('Cannot shut down actionhero, not running', 'error'); }
    if(typeof callback === 'function'){ callback(null, self.api); }
  }
};

actionhero.prototype.restart = function(callback){
  var self = this;
  if(this._self){ self = this._self; }

  if(self.api.running === true){
    self.stop(function(error){
      if(error){ self.api.log(error, 'error'); }
      self.start(self.startingParams, function(error){
        if(error){ self.api.log(error, 'error'); }
        self.api.log('*** ActionHero Restarted ***', 'info');
        if(typeof callback === 'function'){ callback(null, self.api); }
      });
    });
  }else{
    self.start(self.startingParams, function(error){
      if(error){ self.api.log(error, 'error'); }
      self.api.log('*** ActionHero Restarted ***', 'info');
      if(typeof callback === 'function'){ callback(null, self.api); }
    });
  }
};

exports.actionheroPrototype = actionhero;
