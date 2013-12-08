var cache = function(api, next){

  api.cache = {};
  api.cache.sweeperTimer = null;
  api.cache.sweeperTimeout = 60 * 1000;
  api.cache.redisCacheKey = 'actionHero:cache';

  api.cache._start = function(api, callback){
    api.cache.runSweeper();
    callback();
  }

  api.cache._teardown = function(api, next){
    api.cache.stopTimers(api);
    next();
  }

  api.cache.stopTimers = function(api){
    clearTimeout(api.cache.sweeperTimer);
  }

  api.cache.prepareDomain = function(){
    // until the redis module handles domains, we need to force the callback to be bound properly
    // https://github.com/mranney/node_redis/pull/310/files
    return {
      bind: function(callback){
        return callback
      }
    }
  }
    
  api.cache.size = function(next){
    var domain = api.cache.prepareDomain();
    api.redis.client.hlen(api.cache.redisCacheKey, domain.bind(function(err, count){
      next(null, count);
    }));
  }

  api.cache.load = function(key, options, next){
    if(typeof options == 'function'){
      next = options
      options = {}
    }
    var domain = api.cache.prepareDomain();
    api.redis.client.hget(api.cache.redisCacheKey, key, domain.bind(function(err, cacheObj){
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
        }
        api.redis.client.hset(api.cache.redisCacheKey, key, JSON.stringify(cacheObj), domain.bind(function(){
          if(typeof next == 'function'){
            process.nextTick(function(){ next(null, cacheObj.value, cacheObj.expireTimestamp, cacheObj.createdAt, cacheObj.readAt); });
          }
        }));
      } else {
        if(typeof next == 'function'){
          process.nextTick(function(){ next(new Error('Object expired'), null, null, null, null); });
        }
      }
    }));
  };

  api.cache.destroy = function(key, next){
    var domain = api.cache.prepareDomain();
    api.redis.client.hdel(api.cache.redisCacheKey, key, domain.bind(function(err, count){
      api.stats.increment('cache:cachedObjects', -1 );
      if(err != null){ api.log(err, 'error') }
      var resp = true;
      if(count != 1){ resp = false }
      if(typeof next == 'function'){ process.nextTick(function(){ next(null, resp) }) }
    }));
  };

  api.cache.sweeper = function(next){
    var domain = api.cache.prepareDomain();
    api.redis.client.hkeys(api.cache.redisCacheKey, domain.bind(function(err, keys){
      var started = 0;
      var sweptKeys = [];
      keys.forEach(function(key){
        started++;
        api.redis.client.hget(api.cache.redisCacheKey, key, domain.bind(function(err, cacheObj){
          if(err != null){ api.log(err, 'error') }
          try { cacheObj = JSON.parse(cacheObj) } catch(e){}
          if(cacheObj != null){
            if(cacheObj.expireTimestamp != null && cacheObj.expireTimestamp < new Date().getTime()){
              api.redis.client.hdel(api.cache.redisCacheKey, key, domain.bind(function(err, count){
                sweptKeys.push(key);
                started--;
                if(started == 0 && typeof next == 'function'){ next(err, sweptKeys) }
              }));
            } else {
              started--;
              if(started == 0 && typeof next == 'function'){ next(err, sweptKeys) }
            }
          } else {
            started--;
            if(started == 0 && typeof next == 'function'){ next(err, sweptKeys) }
          }
        }));
      });
      if(keys.length == 0 && typeof next == 'function'){ next(err, sweptKeys) }
    }));
  }

  api.cache.save = function(key, value, expireTimeMS, next){
    api.stats.increment('cache:cachedObjects');
    api.stats.increment('cache:totalCachedObjects');
    var domain = api.cache.prepareDomain();
    if(typeof expireTimeMS == 'function' && typeof next == 'undefined'){
      next = expireTimeMS;
      expireTimeMS = null;
    }
    var expireTimestamp = null
    if(null !== expireTimeMS){
      expireTimestamp = new Date().getTime() + expireTimeMS;
    }
    var cacheObj = {
      value: value,
      expireTimestamp: expireTimestamp,
      createdAt: new Date().getTime(),
      readAt: null
    }
    api.redis.client.hset(api.cache.redisCacheKey, key, JSON.stringify(cacheObj), domain.bind(function(){
      if(typeof next == 'function'){ process.nextTick(function(){ next(null, true) }) }
    }));
  };

  api.cache.runSweeper = function(){
    clearTimeout(api.cache.sweeperTimer);
    api.cache.sweeper(function(err, sweptKeys){
      if(sweptKeys.length > 0){
        api.stats.increment('cache:cachedObjects', -1 * sweptKeys.length);
        api.log('cleaned ' + sweptKeys.length + ' expired cache keys', 'debug');
      }
      if(api.running){
        api.cache.sweeperTimer = setTimeout(api.cache.runSweeper, api.cache.sweeperTimeout, api);
      }
    });
  }

  next();
}

/////////////////////////////////////////////////////////////////////
// exports
exports.cache = cache;
