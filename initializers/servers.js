var fs = require("fs");

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
    __dirname + "/../servers/",
    process.cwd() + "/servers/"
  ];
    
  var inits = {}
  for(var i in serverFolders){
    var folder = serverFolders[i];
    if(fs.existsSync(folder)){
      fs.readdirSync(folder).sort().forEach(function(file){
        var fullFilePath = serverFolders[i] + file;
        var ext = file.split('.')[1];
        if (file[0] != "." && ext === 'js'){
          var server = file.split(".")[0];
          if(api.configData.servers[server] != null){
            inits[server] = require(fullFilePath)[server];
          }

          if(api.configData.general.developmentMode == true){
            api.watchedFiles.push(fullFilePath);
            (function() {
              fs.watchFile(fullFilePath, {interval:1000}, function(curr, prev){
                if(curr.mtime > prev.mtime){
                  api.log("\r\n\r\n*** rebooting due to server change ***\r\n\r\n", "info");
                  delete require.cache[require.resolve(fullFilePath)];
                  api._commands.restart.call(api._self);
                }
              });
            })();
          }
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