var servers = function(api, next){

  api.servers = {};

  api.servers._start = function(api, next){
    api.configData.servers.forEach(function(server){
      api.servers.servers.push(server);
    });

    next();
  }

  api.servers._teardown = function(api, next){
    next();
  }
}

exports.servers = servers;