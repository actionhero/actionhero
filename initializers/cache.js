var cache = function(api, next){

  api.cache = {};
  api.cache.sweeperTimer = null;
  api.cache.sweeperTimeout = 60 * 1000;
  api.cache.redisPrefix = 'actionHero:cache:';

  api.cache._start = function(api, callback){
    callback();
  }

  api.cache._teardown = function(api, callback){
    callback();
  }
 
  api.cache.size = function(next){
    api.redis.client.keys(api.cache.redisPrefix + "*", function(err, keys){
      var length = 0;
      if(keys != null){
        length = keys.length;
      }
      next(null, length);
    });
  }

  api.cache.load = function(key, options, next){
    if(typeof options == 'function'){
      next = options;
      options = {};
    }

    api.redis.client.get(api.cache.redisPrefix + key, function(err, cacheObj){
      if(err != null){ api.log(err, 'error') }
      try { cacheObj = JSON.parse(cacheObj) } catch(e){}
      if(cacheObj == null){
        if(typeof next == 'function'){
          process.nextTick(function(){ next(new Error('Object not found'), null, null, null, null); });
        }
      } else if(cacheObj.expireTimestamp >= new Date().getTime() || cacheObj.expireTimestamp == null){
        cacheObj.readAt = new Date().getTime();
        if(cacheObj.expireTimestamp != null && options.expireTimeMS){
          cacheObj.expireTimestamp = new Date().getTime() + options.expireTimeMS;
          var expireTimeSeconds = Math.ceil(options.expireTimeMS / 1000);
        }
        api.redis.client.set(api.cache.redisPrefix + key, JSON.stringify(cacheObj), function(err){
          if(expireTimeSeconds != null){
            api.redis.client.expire(api.cache.redisPrefix + key, expireTimeSeconds);
          }
          if(typeof next == 'function'){
            process.nextTick(function(){ next(err, cacheObj.value, cacheObj.expireTimestamp, cacheObj.createdAt, cacheObj.readAt); });
          }
        });
      } else {
        if(typeof next == 'function'){
          process.nextTick(function(){ next(new Error('Object expired'), null, null, null, null); });
        }
      }
    });

  };

  api.cache.destroy = function(key, next){
    api.redis.client.del(api.cache.redisPrefix + key, function(err, count){
      if(err != null){ api.log(err, 'error') }
      var resp = true;
      if(count != 1){ resp = false }
      if(typeof next == 'function'){ process.nextTick(function(){ next(null, resp) }) }
    });
  };

  api.cache.save = function(key, value, expireTimeMS, next){
    if(typeof expireTimeMS == 'function' && typeof next == 'undefined'){
      next = expireTimeMS;
      expireTimeMS = null;
    }
    var expireTimeSeconds = null
    var expireTimestamp = null
    if(null !== expireTimeMS){
      expireTimeSeconds = Math.ceil(expireTimeMS / 1000);
      expireTimestamp   = new Date().getTime() + expireTimeMS;
    }
    var cacheObj = {
      value:           value,
      expireTimestamp: expireTimestamp,
      createdAt:       new Date().getTime(),
      readAt:          null
    }
    api.redis.client.set(api.cache.redisPrefix + key, JSON.stringify(cacheObj), function(err){
      if(err == null && expireTimeSeconds != null){
        api.redis.client.expire(api.cache.redisPrefix + key, expireTimeSeconds);
      }
      if(typeof next == 'function'){ process.nextTick(function(){ next(err, true) }) }
    });
  };

  next();
}

/////////////////////////////////////////////////////////////////////
// exports
exports.cache = cache;
