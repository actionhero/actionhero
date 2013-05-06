var fs = require("fs");

var servers = function(api, next){

  api.servers = {};
  api.servers.servers = [];

  api.servers._start = function(api, next){
    var started = 0;
    for(var server in api.configData.servers){
      started++;
      api.log("starting server: " + server, "notice");
      api.servers.servers[server]._start(function(){
        process.nextTick(function(){
          started--;
          if(started == 0){ next(); }
        });
      });
    };    
  }

  api.servers._teardown = function(api, next){
    var started = 0;
    for(var server in api.servers.servers){
      started++;
      api.log("stopping server: " + server, "notice");
      api.servers.servers[server]._teardown(function(){        
        process.nextTick(function(){
          started--;
          if(started == 0){ next(); }
        });
      });
    };
  }

  // Load the servers

  var serverFolders = [ 
    process.cwd() + "/servers/", 
    __dirname + "/servers/"
  ];
    
  var inits = {}
  for(var i in serverFolders){
    var folder = serverFolders[i];
    if(fs.existsSync(folder)){
      fs.readdirSync(folder).sort().forEach(function(file){
        if (file[0] != "."){
          var server = file.split(".")[0];
          if(api.configData.servers[server] != null){
            if(require.cache[serverFolders[i] + file] !== null){
              delete require.cache[serverFolders[i] + file];
            }
            inits[server] = require(serverFolders[i] + file)[server];
          }
        }
      });
    }
  }

  var started = 0;
  for(var server in inits){
    started++;
    var options = api.configData.servers[server];
    inits[server](api, options, function(serverObject){
      api.servers.servers[server] = serverObject;
      api.log("initialized server: " + server, "debug");
      process.nextTick(function(){
        started--;
        if(started == 0){ next(); }
      });
    });
  }
  if(started == 0){ next(); }
}

exports.servers = servers;