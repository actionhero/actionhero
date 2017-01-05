'use strict';

const path = require('path');
const async = require('async');

module.exports = {
  startPriority: 900,
  stopPriority:  100,
  loadPriority:  599,
  initialize: function(api, next){

    api.servers = {};
    api.servers.servers = {};

    // Load the servers

    let serverFolders = [
      path.resolve(__dirname + '/../servers')
    ];

    api.config.general.paths.server.forEach((p) => {
      p = path.resolve(p);
      if(serverFolders.indexOf(p) < 0){
        serverFolders.push(p);
      }
    });

    let jobs = [];

    serverFolders.forEach((p) => {
      api.utils.recursiveDirectoryGlob(p).forEach((f) => {
        let parts = f.split(/[\/\\]+/);
        let serverName = parts[(parts.length - 1)].split('.')[0];
        if(api.config.servers[serverName] && api.config.servers[serverName].enabled === true){
          let init = require(f).initialize;
          let options = api.config.servers[serverName];
          jobs.push((done) => {
            init(api, options, (serverObject) => {
              api.servers.servers[serverName] = serverObject;
              api.log(['Initialized server: %s', serverName], 'debug');
              return done();
            });
          });
        }
        api.watchFileAndAct(f, () => {
          api.log(['*** Rebooting due to server (%s) change ***', serverName], 'info');
          api.commands.restart();
        });
      });
    });

    async.series(jobs, next);
  },

  start: function(api, next){
    let jobs = [];
    Object.keys(api.servers.servers).forEach((serverName) => {
      let server = api.servers.servers[serverName];
      if(server && server.options.enabled === true){
        let message = '';
        let messageArgs = [];
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

        jobs.push((done) => {
          api.log([message].concat(messageArgs), 'notice');
          server.start((error) => {
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
    let jobs = [];
    Object.keys(api.servers.servers).forEach((serverName) => {
      let server = api.servers.servers[serverName];
      if((server && server.options.enabled === true) || !server){
        jobs.push((done) => {
          api.log(['Stopping server: %s', serverName], 'notice');
          server.stop((error) => {
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
