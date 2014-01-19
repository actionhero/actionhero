var redis = function(api, next){

  /* actionhero will create the following stores within your redis database:

  ** Keys **

  - 'actionhero:cache' [] the common shared cache object
  - 'actionhero:stats' [] the common shared stats object
  - 'actionhero:roomMembers-{roomName}' [] a list of the folks in a given socket room
  */

  api.redis = {};
  api.redis.fake = api.config.redis.fake;
  if(api.config.redis.database == null){ api.config.redis.database = 0 }

  var redisPackage;
  if(api.redis.fake == true){
    api.log('running with fakeredis', 'warning');
    redisPackage = require('fakeredis');
    redisPackage.fast = true;
  } else {
    redisPackage = require('redis');
  }

  api.redis._start = function(api, next){
    next();
  }
    
  api.redis.initialize = function(callback){
    api.redis.client = redisPackage.createClient(api.config.redis.port, api.config.redis.host, api.config.redis.options);
    api.redis.client.on('error', function(err){
      api.log('Redis Error: ' + err, 'emerg');
    });

    api.redis.client.on('connect', function(err){
      api.log('connected to redis', 'debug');
    });

    if(api.config.redis.password != null && api.config.redis.password != ''){
      api.redis.client.auth(api.config.redis.password, function(){
        api.redis.client.select(api.config.redis.database, function(err){
          if(err){ api.log('Error selecting database #' + api.config.redis.database + ' on redis.  exiting', 'emerg'); }
          callback();
        });
      });
    } else if(api.config.redis.fake != true){
      process.nextTick(function(){
        api.redis.client.select(api.config.redis.database, function(err){
          if(err){ api.log('Error selecting database #' + api.config.redis.database + ' on redis.  exiting', 'emerg'); }
          callback();
        });
      });
    } else {
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
