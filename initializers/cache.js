var cache = function(api, next){

  api.cache = {};
  api.cache.sweeperTimer = null;
  api.cache.sweeperTimeout = 10 * 1000;

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
    if(api.domain != null && process.domain != null){
      return process.domain;
    }else{
      return {
        bind: function(callback){
          return callback
        }
      };
    }
  }

  if(api.redis && api.redis.enable === true){
    
    var redisCacheKey = "actionHero:cache";

    api.cache.size = function(next){
      var domain = api.cache.prepareDomain();
      api.redis.client.hlen(redisCacheKey, domain.bind(function(err, count){
        next(null, count);
      }));
    }

    api.cache.load = function(key, next){
      var domain = api.cache.prepareDomain();
      api.redis.client.hget(redisCacheKey, key, domain.bind(function(err, cacheObj){
        if(err != null){ api.log(err, "error"); }
        try{ var cacheObj = JSON.parse(cacheObj); }catch(e){ }
        if(cacheObj == null){
          if(typeof next == "function"){ 
            process.nextTick(function() { next(new Error("Object not found"), null, null, null, null); });
          }
        }else if( cacheObj.expireTimestamp >= new Date().getTime() || cacheObj.expireTimestamp == null ){
          cacheObj.readAt = new Date().getTime();
          api.redis.client.hset(redisCacheKey, key, JSON.stringify(cacheObj), domain.bind(function(){
            if(typeof next == "function"){  
              process.nextTick(function() { next(null, cacheObj.value, cacheObj.expireTimestamp, cacheObj.createdAt, cacheObj.readAt); });
            }
          }));
        }else{
          if(typeof next == "function"){ 
            process.nextTick(function() { next(new Error("Object expired"), null, null, null, null); });
          }
        }
      }));
    };

    api.cache.destroy = function(key, next){
      var domain = api.cache.prepareDomain();
      api.redis.client.hdel(redisCacheKey, key, domain.bind(function(err, count){
        api.stats.increment("cache:cachedObjects", -1 );
        if(err != null){ api.log(err, "error"); }
        var resp = true;
        if(count != 1){ resp = false; }
        if(typeof next == "function"){  process.nextTick(function() { next(null, resp); }); }
      }));
    };

    api.cache.sweeper = function(next){
      var domain = api.cache.prepareDomain();
      api.redis.client.hkeys(redisCacheKey, domain.bind(function(err, keys){
        var started = 0;
        var sweepedKeys = [];
        keys.forEach(function(key){
          started++;
          api.redis.client.hget(redisCacheKey, key, domain.bind(function(err, cacheObj){
            if(err != null){ api.log(err, "error"); }
            try{ var cacheObj = JSON.parse(cacheObj); }catch(e){ }
            if(cacheObj != null){
              if(cacheObj.expireTimestamp != null && cacheObj.expireTimestamp < new Date().getTime()){
                api.redis.client.hdel(redisCacheKey, key, domain.bind(function(err, count){
                  sweepedKeys.push(key);
                  started--;
                  if(started == 0 && typeof next == "function"){ next(err, sweepedKeys); }
                }));
              }else{
                started--;
                if(started == 0 && typeof next == "function"){ next(err, sweepedKeys); }
              }
            }else{
              started--;
              if(started == 0 && typeof next == "function"){ next(err, sweepedKeys); }
            }
          }));
        });
        if(keys.length == 0 && typeof next == "function"){ next(err, sweepedKeys); }
      }));
    }

  }else{

    api.cache.data = {};

    api.cache.size = function(next){
      var domain = api.cache.prepareDomain();
      process.nextTick(function(){
        next(null, api.utils.hashLength(api.cache.data));
      });
    }

    api.cache.load = function(key, next){
      var domain = api.cache.prepareDomain();
      var cacheObj = api.cache.data[key];
      if(cacheObj == null){
        api.stats.increment("cache:nullCacheLoads");
        process.nextTick(function() { next(new Error("Object not found"), null, null, null, null); });
      }else{
        api.stats.increment("cache:succesfullCacheLoads");
        if(cacheObj.expireTimestamp >= new Date().getTime() || cacheObj.expireTimestamp == null ){
          api.cache.data[key].readAt = new Date().getTime();
          if(typeof next == "function"){  
            process.nextTick(function() { next(null, cacheObj.value, cacheObj.expireTimestamp, cacheObj.createdAt, cacheObj.readAt); });
          }
        }else{
          if(typeof next == "function"){ 
            process.nextTick(function() { next(new Error("Object expired"), null, null, null, null); });
          }
        }
      }
    };

    api.cache.destroy = function(key, next){
      var domain = api.cache.prepareDomain();
      var cacheObj = api.cache.data[key];
      if(typeof cacheObj == "undefined"){
        if(typeof next == "function"){  process.nextTick(function() { next(null, false); }); }
      }else{
        delete api.cache.data[key];
        api.stats.increment("cache:cachedObjects", -1 );
        if(typeof next == "function"){  process.nextTick(function() { next(null, true); }); }
      }
    };

    api.cache.sweeper = function(next){
      var domain = api.cache.prepareDomain();
      var sweepedKeys = [];
      for (var i in api.cache.data){
        var entry = api.cache.data[i];
        if ( entry.expireTimestamp != null && entry.expireTimestamp < new Date().getTime() ){
          sweepedKeys.push(i);
          delete api.cache.data[i];
        }
      }
      if(typeof next == "function"){ next(null, sweepedKeys); }
    }
  }

  api.cache.save = function(key, value, expireTimeMS, next){
    api.stats.increment("cache:cachedObjects");
    api.stats.increment("cache:totalCachedObjects");
    var domain = api.cache.prepareDomain();
    if(typeof expireTimeMS == "function" && typeof next == "undefined"){
      next = expireTimeMS;
      expireTimeMS = null;
    }
    if(expireTimeMS != null){
      var expireTimestamp = new Date().getTime() + expireTimeMS;
    }else{
      expireTimestamp = null;
    }
    var cacheObj = {
      value: value,
      expireTimestamp: expireTimestamp,
      createdAt: new Date().getTime(),
      readAt: null
    }
    if(api.redis && api.redis.enable === true){
      api.redis.client.hset(redisCacheKey, key, JSON.stringify(cacheObj), domain.bind(function(){
        if(typeof next == "function"){ process.nextTick(function() { next(null, true); }); }
      }));
    }else{
      try{
        api.cache.data[key] = cacheObj;
        if(typeof next == "function"){ process.nextTick(function() { next(null, true); }); }
      }catch(e){
        api.log("Cache save error: " + e, "error");
        if(typeof next == "function"){  process.nextTick(function() { next(null, false); }); }
      }
    }
  };

  api.cache.runSweeper = function(){
    clearTimeout(api.cache.sweeperTimer);
    api.cache.sweeper(function(err, sweepedKeys){
      if(sweepedKeys.length > 0){
        api.stats.increment("cache:cachedObjects", -1 * sweepedKeys.length);
        api.log("cleaned " + sweepedKeys.length + " expired cache keys", "debug");
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
