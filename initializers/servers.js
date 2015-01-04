var path = require('path');

module.exports = {
  startPriority: 900,
  stopPriority:  100,
  loadPriority:  599,
  initialize: function(api, next){

    api.servers = {};
    api.servers.servers = [];

    // Load the servers

    var serverFolders = [
      path.resolve(__dirname + '/../servers')
    ];

    api.config.general.paths.server.forEach(function(p){
      p = path.resolve(p);
      if(serverFolders.indexOf(p) < 0){
        serverFolders.push(p);
      }
    })

    var inits = {}

    serverFolders.forEach(function(p){
      api.utils.recursiveDirectoryGlob(p).forEach(function(f){
        var parts = f.split(/[\/\\]+/)
        var server = parts[(parts.length - 1)].split('.')[0];
        if(api.config.servers[server] && api.config.servers[server].enabled === true){
          inits[server] = require(f)['initialize'];
        }
        api.watchFileAndAct(f, function(){
          api.log('\r\n\r\n*** rebooting due to server ('+server+') change ***\r\n\r\n', 'info');
          api.commands.restart.call(api._self);
        });
      });
    })

    var started = 0;
    for(var server in inits){
      started++;
      (function(server){
        var options = api.config.servers[server];
        inits[server](api, options, function(serverObject){
          api.servers.servers[server] = serverObject;
          api.log('initialized server: ' + server, 'debug');
          process.nextTick(function(){
            started--;
            if(started === 0){ next() }
          });
        });
      })(server)
    }
    if(started === 0){ next() }
  },

  start: function(api, next){
    var started = 0;
    if(api.utils.hashLength(api.servers.servers) === 0){ next() }
    for(var server in api.servers.servers){
      started++;
      if(api.config.servers[server] && api.config.servers[server].enabled === true){
        api.log('starting server: ' + server, 'notice');
        api.servers.servers[server].start(function(){
          process.nextTick(function(){
            started--;
            if(started === 0){ next() }
          });
        });
      }else{
        process.nextTick(function(){
          started--;
          if(started === 0){ next() }
        });
      }
    }
  },

  stop: function(api, next){
    var started = 0;
    if(api.utils.hashLength(api.servers.servers) === 0){ next() }
    for(var server in api.servers.servers){
      started++;
      (function(server){
        api.log('stopping server: ' + server, 'notice');
        api.servers.servers[server].stop(function(){
          process.nextTick(function(){
            api.log('server stopped: ' + server, 'debug');
            started--;
            if(started === 0){ next() }
          });
        });
      })(server)
    }
  }
}