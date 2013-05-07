var stats = function(api, next){
  api.stats = {};
  api.stats.data = {};
  api.stats.collections = {
    local: 'actionHero:stats:' + api.id.replace(/:/g, "-"),
    global: 'actionHero:stats:global'
  }

  api.stats.increment = function(key, count, next){
    if(count == null){ count = 1; }
    count = parseFloat(count);
    api.redis.client.multi()
      .hincrby(api.stats.collections.local, key, count)
      .hincrby(api.stats.collections.global, key, count)
      .exec(function(){
        if(typeof next == "function"){ process.nextTick(function() { next(null, true); }); }
      });
  }

  api.stats.set = function(key, count, next){
    if(count == null){ count = 1; }
    count = parseFloat(count);
    api.redis.client.hset(api.stats.collections.local, key, count, function(err){
      if(typeof next == "function"){ process.nextTick(function() { next(null, true); }); }
    });
  }

  api.stats.get = function(key, collection, next){
    api.redis.client.hget(collection, key, function(err, cacheObj){
      next(err, cacheObj);
    });
  }

  api.stats.getAll = function(next){
    api.redis.client.multi()
      .hgetall(api.stats.collections.global)
      .hgetall(api.stats.collections.local)
      .exec(function(err, stats){
        var globalStats = stats[0];
        var localStats = stats[1];
        if(globalStats == null){ globalStats = {}; }
        if(localStats == null){ localStats = {}; }

        var results = {
          global: {},
          local: {},
        }

        for(var key in globalStats){
          api.utils.hasifyNestedString(key, globalStats[key], results.global);
        }

        for(var key in localStats){
          api.utils.hasifyNestedString(key, localStats[key], results.local);
        }

        next(err, results);
      });
  }
  
  next();
}

/////////////////////////////////////////////////////////////////////
// exports
exports.stats = stats;
