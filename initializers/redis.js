var redis = function(api, next){  

  /* actionHero will create the following stores within your redis database:

  ** Keys **

  - `actionHero:cache` [] the common shared cache object
  - `actionHero:stats` [] the common shared stats object
  - `actionHero:roomMembers-{roomName}` [] a list of the folks in a given socket room
  */

  api.redis = {};
  api.redis.fake = api.configData.redis.fake;

  if(api.configData.redis.database == null){ api.configData.redis.database = 0; }

  if(api.redis.fake == true){
    api.log("running with fakeredis", "warning");
    var redisPackage = require('fakeredis');
    redisPackage.fast = true;
  }else{
    var redisPackage = require('redis');
  }

  api.redis._start = function(api, next){
    next();
  }

  api.redis._teardown = function(api, next){
    next();
  }
    
  api.redis.initialize = function(callback){
    api.redis.client = redisPackage.createClient(api.configData.redis.port, api.configData.redis.host, api.configData.redis.options);
    api.redis.client.on("error", function (err) {
      api.log("Redis Error: " + err, "emerg");
    });

    api.redis.client.on("connect", function (err) {
      api.log("connected to redis", "debug");
    });

    if(api.configData.redis.password != null && api.configData.redis.password != ""){
      api.redis.client.auth(api.configData.redis.password, function(){
        api.redis.client.select(api.configData.redis.database, function(err){
          if(err){ api.log("Error selecting database #"+api.configData.redis.database+" on redis.  exiting", "emerg"); }
            callback();
        });
      }); 
    }else if(api.configData.redis.fake != true){
      process.nextTick(function(){
        api.redis.client.select(api.configData.redis.database, function(err){
          if(err){ api.log("Error selecting database #"+api.configData.redis.database+" on redis.  exiting", "emerg"); }
          callback();
        });
      });
    }else{
      process.nextTick(function(){
        callback();
      });
    }
  };

  api.redis.initialize(function(){
    next();
  });

}

/////////////////////////////////////////////////////////////////////
// exports
exports.redis = redis;