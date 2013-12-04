var specHelper = {}
specHelper.fs = require('fs');
specHelper.net = require('net');
specHelper.should = require('should');
specHelper.request = require('request');
specHelper.apis = [];
specHelper.actionHeroes = [];
specHelper.queue = "testQueue";
specHelper.url = "127.0.0.1";
specHelper.params = [];
specHelper.startingWebPort = 9000;
specHelper.startingSocketPort = 8000;

var toFakeRedis = false;
if(process.env['fakeredis'] != null){
  if(process.env['fakeredis'] == 'true'){ toFakeRedis = true; }
  if(process.env['fakeredis'] == 'false'){ toFakeRedis = false; }
}

console.log("\r\n>>> running test sute with fakeredis=" + toFakeRedis + " <<<");

var redisConfig = {
  "fake": toFakeRedis,
  "host": "127.0.0.1",
  "port": 6379,
  "password": null,
  "options": null,
  "DB": 2
}

var actionHeroPrototype = require(__dirname + "/../actionHero.js").actionHeroPrototype;

specHelper.clearRedis = function(serverID, next){
  if(serverID != 0){
    next();
  }else{
    if(toFakeRedis){
      var redis = require('fakeredis');
      var client = redis.createClient(redisConfig.port, redisConfig.host, redisConfig.options);
      redis.fast = true;
      client.flushdb(function(){
        next();
      });
    }else{
      var redis = require('redis');
      var client = redis.createClient(redisConfig.port, redisConfig.host, redisConfig.options);
      client.on("ready", function (err) {
        client.select(redisConfig.database, function(){
          client.flushdb(function(){
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
}

// tables to truncate each round of testing
specHelper.tables = [ "Logs" ];

specHelper.prepare = function(serverID, next){
  if(serverID == null){serverID = 0};
  specHelper.clearRedis(serverID, function(){
    if(specHelper.actionHeroes[serverID] != null){
      specHelper.restartServer(serverID, function(api){
        next(api);
      });
    }else{
      specHelper.startServer(serverID, function(api){
        next(api);
      });
    }
  });
}

////////////////////////////////////////////////////////////////////////////
// Start Test Server
specHelper.startServer = function(serverID, next){
  if(serverID == null){serverID = 0};
  var port = specHelper.startingSocketPort + serverID;
  var conn = specHelper.net.createConnection(port, specHelper.url, function(){
    next(specHelper.apis[serverID]);
    conn.destroy();
  });
  conn.on('error', function(err) { 
    if(err.code == "ECONNREFUSED"){
      specHelper.actionHeroes[serverID] = new actionHeroPrototype();
      var configChanges = {
        general: {
          id: 'test-server-' + (serverID + 1),
        },
        servers: {
          web:    {port: (specHelper.startingWebPort + serverID)},
          socket: {port: (specHelper.startingSocketPort + serverID)},
        }
      }
      specHelper.actionHeroes[serverID].start({configChanges: configChanges}, function(err, api){
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
      specHelper.apis[serverID] = api;
      next(specHelper.apis[serverID]);
    });
  }else{
    next(false);
  }
};

specHelper.restartServer = function(serverID, next){
  if(serverID == null){serverID = 0};
  specHelper.actionHeroes[serverID].restart(function(err, api){
    specHelper.apis[serverID] = api;
    next(specHelper.apis[serverID]);
  });
};

////////////////////////////////////////////////////////////////////////////
// API request
specHelper.apiTest = {
  general: function(method, serverID, url, data, cb){
    if(serverID == null){serverID = 0};
    var port = (specHelper.startingWebPort + serverID);
    var params = {}
    params.method = method;
    if(url.indexOf("?") > -1){
      params.url = "http://"  + specHelper.url + ":" + port + (url||'');
    }else{
      params.url = "http://"  + specHelper.url + ":" + port + (url||'') + "?";
      for(var i in data){
        params.url += i + "=" + data[i] + "&";
      }
    }

    process.nextTick(function(){
      specHelper.request(params, function(err, response, body){
        var json = null;
        try{ json = JSON.parse(response.body); }catch(e){ };
        cb( response, json );
      });
    });
  },
  get:     function( url, serverID, data, cb  ){ specHelper.apiTest.general( 'GET', serverID, url, data, cb     ) },
  post:    function( url, serverID, data, cb  ){ specHelper.apiTest.general( 'POST', serverID, url, data, cb    ) },
  put:     function( url, serverID, data, cb  ){ specHelper.apiTest.general( 'PUT', serverID, url, data, cb     ) },
  del:     function( url, serverID, data, cb  ){ specHelper.apiTest.general( 'DELETE', serverID, url, data, cb  ) },
  head:    function( url, serverID, data, cb  ){ specHelper.apiTest.general( 'HEAD', serverID, url, data, cb    ) },
  trace:   function( url, serverID, data, cb  ){ specHelper.apiTest.general( 'TRACE', serverID, url, data, cb   ) },
  options: function( url, serverID, data, cb  ){ specHelper.apiTest.general( 'OPTIONS', serverID, url, data, cb ) },
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
  cleanAPI["config"] = api["config"];
  cleanAPI["stats"] = api["stats"];
  cleanAPI["cache"] = api["cache"];
  cleanAPI["redis"] = api["redis"];
  cleanAPI["params"] = api["params"];
  cleanAPI["routes"] = api["routes"];
  cleanAPI["connections"] = api["connections"];
  cleanAPI["chatRoom"] = api["chatRoom"];
  return cleanAPI
}

////////////////////////////////////////////////////////////////////////////
// EXPORT
exports.specHelper = specHelper;
