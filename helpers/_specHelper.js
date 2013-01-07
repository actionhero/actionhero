var specHelper = {}
var showLogs = true;
specHelper.fs = require('fs');
specHelper.net = require('net');
specHelper.should = require('should');
specHelper.request = require('request');
specHelper.utils = require(__dirname + '/../helpers/utils.js').utils;
specHelper.apis = [];
specHelper.actionHeroes = [];
specHelper.url = "127.0.0.1";
specHelper.params = [];

var redisConfig = {
  "enable": true,
  "host": "127.0.0.1",
  "port": 6379,
  "password": null,
  "options": null,
  "DB": 2
}

var actionHeroPrototype = require(__dirname + "/../actionHero.js").actionHeroPrototype;

specHelper.params[0] = {
  general: {
    workers: 1,
    "developmentMode": true,
  },
  log: {
    logging: showLogs,
    logFile: "api_peer_1.log",
  },
  httpServer: {
    enable: true,
    secure: false,
    port: 9000,
  },
  tcpServer: {
    secure: false,
    enable: true,
    port: 8000,
  },
  webSockets: {
    enable: true
  },
  redis : redisConfig,
};

specHelper.params[1] = {
  general: {
    workers: 1,
    "developmentMode": false,
  },
  log: {
    logging: showLogs,
    logFile: "api_peer_2.log",
  },
  httpServer: {
    secure: false,
    enable: true,
    port: 9001,
  },
  tcpServer: {
    secure: false,
    enable: true,
    port: 8001,
  },
  webSockets: {
    enable: true
  },
  redis : redisConfig,
};

specHelper.params[2] = {
  general: {
    workers: 1,
    "developmentMode": false,
  },
  log: {
    logging: showLogs,
    logFile: "api_peer_3.log",
  },
  httpServer: {
    secure: false,
    enable: true,
    port: 9002,
  },
  tcpServer: {
    secure: false,
    enable: true,
    port: 8002,
  },
  webSockets: {
    enable: true
  },
  redis : redisConfig,
};

specHelper.clearRedis = function(serverID, next){
  if(serverID != 0){
    next();
  }else{
    var redis = require('redis');
    var client = redis.createClient(redisConfig.port, redisConfig.host, redisConfig.options);
    client.on("ready", function (err) {
      client.select(redisConfig.DB, function(){
          client.flushdb(function(){
            // process.stdout.write("[ test redis emptied ] ");
            next();
          });
      });
    });
    client.on("error", function (err) {
        process.stdout.write("\r\n\r\n!! Redis Error: " + err + "\r\n\r\n");
        process.exit();  // redis is really important...
    });
  }
}

// tables to truncate each round of testing
specHelper.tables = [ "Logs" ];

specHelper.prepare = function(serverID, next){
  if(serverID == null){serverID = 0};
  specHelper.clearRedis(serverID, function(){
    specHelper.startServer(serverID, function(api){
      next(api);
    });
  });
}

////////////////////////////////////////////////////////////////////////////
// Start Test Server
specHelper.startServer = function(serverID, next){
  if(serverID == null){serverID = 0};
  var conn = specHelper.net.createConnection(specHelper.params[serverID].httpServer.port, specHelper.url, function(){
    next(specHelper.apis[serverID]);
    conn.destroy();
  });
  conn.on('error', function(err) { 
    if(err.code == "ECONNREFUSED"){
      specHelper.actionHeroes[serverID] = new actionHeroPrototype();
      specHelper.actionHeroes[serverID].start({configChanges: specHelper.params[serverID]}, function(err, api){
        specHelper.apis[serverID] = api;
        conn.destroy();
        next(specHelper.apis[serverID]);
      });
    }else{
      conn.destroy();
      next(specHelper.apis[serverID]);
    }
  }); 
}

specHelper.stopServer = function(serverID, next){
  if(serverID == null){serverID = 0};
  if(specHelper.actionHeroes[serverID] != null){
    specHelper.actionHeroes[serverID].stop(function(err, api){
      next(err, api);
    });
  }else{
    next(false);
  }
};

specHelper.restartServer = function(serverID, next){
  if(serverID == null){serverID = 0};
  specHelper.actionHeroes[serverID].restart(function(err, api){
    next(err, api);
  });
};

////////////////////////////////////////////////////////////////////////////
// API request
specHelper.apiTest = {
  general: function(method, serverID, url, data, cb){
    if(serverID == null){serverID = 0};
    var params = {}
    params.method = method;
    if(url.indexOf("?") > -1){
      params.url = "http://"  + specHelper.url + ":" + specHelper.params[serverID].httpServer.port + (url||'');
    }else{
      params.url = "http://"  + specHelper.url + ":" + specHelper.params[serverID].httpServer.port + (url||'') + "?";
      for(var i in data){
        params.url += i + "=" + data[i] + "&";
      }
    }

    specHelper.request(params,function(req, res){
      try{ res.body = JSON.parse(res.body); }catch(e){};
      cb( res );
    })
  },
  get: function( url, serverID, data, cb  ){ specHelper.apiTest.general( 'GET', serverID, url, data, cb    )  },
  post: function( url, serverID, data, cb ){ specHelper.apiTest.general( 'POST', serverID, url, data, cb   )  },
  put: function( url, serverID, data, cb  ){ specHelper.apiTest.general( 'PUT', serverID, url, data, cb    )  },
  del: function( url, serverID, data, cb  ){ specHelper.apiTest.general( 'DELETE', serverID, url, data, cb )  }
}

specHelper.resetCookieJar = function(){
  var j = specHelper.request.jar()
  specHelper.request = specHelper.request.defaults({jar:j})
}

////////////////////////////////////////////////////////////////////////////
// API object cleanup
specHelper.cleanAPIObject = function(api){
  var cleanAPI = {}
  cleanAPI["actions"] = api["actions"];
  cleanAPI["tasks"] = api["tasks"];
  cleanAPI["utils"] = api["utils"];
  cleanAPI["configData"] = api["configData"];
  cleanAPI["stats"] = api["stats"];
  cleanAPI["cache"] = api["cache"];
  cleanAPI["redis"] = api["redis"];
  cleanAPI["postVariables"] = api["postVariables"];
  cleanAPI["connections"] = api["connections"];
  cleanAPI["chatRoom"] = api["chatRoom"];
  return cleanAPI
}

////////////////////////////////////////////////////////////////////////////
// EXPORT
exports.specHelper = specHelper;