var redis = function(api, next){

  api.redis = {};
  if(api.config.redis.database == null){ api.config.redis.database = 0 }

  var redisPackage;
  if(api.config.redis.package === 'fakeredis'){
    api.log('running with fakeredis', 'warning');
    redisPackage = require(api.config.redis.package);
    redisPackage.fast = true;
  } else {
    redisPackage = require(api.config.redis.package);
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
      if(api.config.redis.database != null){ api.redis.client.select(api.config.redis.database); }
      api.log('connected to redis', 'debug');
    });

    if(api.config.redis.password != null && api.config.redis.password != ''){
      api.redis.client.auth(api.config.redis.password, function(){
        api.redis.client.select(api.config.redis.database, function(err){
          if(err){ api.log('Error selecting database #' + api.config.redis.database + ' on redis.  exiting', 'emerg'); }
          callback();
        });
      });
    } else if(api.config.redis.package === 'fakeredis'){
      process.nextTick(function(){
        api.redis.client.select(api.config.redis.database, function(err){
          if(err){ api.log('Error selecting database #' + api.config.redis.database + ' on redis.  exiting', 'emerg'); }
          callback();
        });
      });
    } else {
      process.nextTick(function(){
        if(api.config.redis.database != null){ api.redis.client.select(api.config.redis.database); }
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
