var fs = require("fs");
var path = require("path");

var servers = function(api, next){

  api.servers = {};
  api.servers.servers = [];

  api.servers._start = function(api, next){
    var started = 0;
    if(api.utils.hashLength(api.configData.servers) == 0){ next(); }
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
    if(api.utils.hashLength(api.servers.servers) == 0){ next(); }
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
    __dirname + "/../servers",
    api.configData.general.paths.server,
  ];
    
  var inits = {}
  for(var i in serverFolders){
    var folder = serverFolders[i];
    if(fs.existsSync(folder)){
      fs.readdirSync(folder).sort().forEach(function(file){
        var fullFilePath = path.resolve(serverFolders[i] + "/" + file);
        var fileParts = file.split('.');
        var ext = fileParts[(fileParts.length - 1)];
        if (file[0] != "." && ext === 'js'){
          var server = file.split(".")[0];
          if(api.configData.servers[server] != null){
            inits[server] = require(fullFilePath)[server];
          }

          api.watchFileAndAct(fullFilePath, function(){
            api.log("\r\n\r\n*** rebooting due to server ("+fullFilePath+") change ***\r\n\r\n", "info");
            delete require.cache[require.resolve(fullFilePath)];
            api._commands.restart.call(api._self);
          });
        }
      });
    }
  }

  var started = 0;
  for(var server in inits){
    started++;
    (function(server){
      var options = api.configData.servers[server];
      inits[server](api, options, function(serverObject){
        api.servers.servers[server] = serverObject;
        api.log("initialized server: " + server, "debug");
        process.nextTick(function(){
          started--;
          if(started == 0){ next(); }
        });
      });
    })(server)
  }
  if(started == 0){ next(); }
}

exports.servers = servers;