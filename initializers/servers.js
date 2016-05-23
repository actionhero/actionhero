'use strict';

var path = require('path');
var async = require('async');

module.exports = {
  startPriority: 900,
  stopPriority:  100,
  loadPriority:  599,
  initialize: function(api, next){

    api.servers = {};
    api.servers.servers = {};

    // Load the servers

    var serverFolders = [
      path.resolve(__dirname + '/../servers')
    ];

    api.config.general.paths.server.forEach(function(p){
      p = path.resolve(p);
      if(serverFolders.indexOf(p) < 0){
        serverFolders.push(p);
      }
    });

    var jobs = [];

    serverFolders.forEach(function(p){
      api.utils.recursiveDirectoryGlob(p).forEach(function(f){
        var parts = f.split(/[\/\\]+/);
        var serverName = parts[(parts.length - 1)].split('.')[0];
        if(api.config.servers[serverName] && api.config.servers[serverName].enabled === true){
          var init = require(f).initialize;
          var options = api.config.servers[serverName];
          jobs.push(function(done){
            init(api, options, function(serverObject){
              api.servers.servers[serverName] = serverObject;
              api.log(['Initialized server: %s', serverName], 'debug');
              return done();
            });
          });
        }
        api.watchFileAndAct(f, function(){
          api.log(['*** Rebooting due to server (%s) change ***', serverName], 'info');
          api.commands.restart.call(api._self);
        });
      });
    });

    async.series(jobs, next);
  },

  start: function(api, next){
    var jobs = [];
    Object.keys(api.servers.servers).forEach(function(serverName){
      var server = api.servers.servers[serverName];
      if(server && server.options.enabled === true){
        var message = '';
        var messageArgs = [];
        message += 'Starting server: `%s`';
        messageArgs.push(serverName);
        if(api.config.servers[serverName].bindIP){
          message += ' @ %s';
          messageArgs.push(api.config.servers[serverName].bindIP);
        }
        if(api.config.servers[serverName].port){
          message += ':%s';
          messageArgs.push(api.config.servers[serverName].port);
        }

        jobs.push(function(done){
          api.log([message].concat(messageArgs), 'notice');
          server.start(function(error){
            if(error){ return done(error); }
            api.log(['Server started: %s', serverName], 'debug');
            return done();
          });
        });
      }
    });

    async.series(jobs, next);
  },

  stop: function(api, next){
    var jobs = [];
    Object.keys(api.servers.servers).forEach(function(serverName){
      var server = api.servers.servers[serverName];
      if((server && server.options.enabled === true) || !server){
        jobs.push(function(done){
          api.log(['Stopping server: %s', serverName], 'notice');
          server.stop(function(error){
            if(error){ return done(error); }
            api.log(['Server stopped: %s', serverName], 'debug');
            return done();
          });
        });
      }
    });

    async.series(jobs, next);
  }
};
