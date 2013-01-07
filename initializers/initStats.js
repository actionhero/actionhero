////////////////////////////////////////////////////////////////////////////
// initStats

var initStats = function(api, next){
  api.stats = {};
  api.stats.data = {};
  api.stats.collections = {
    local: 'actionHero:stats:' + api.id.replace(/:/g, "-"),
    global: 'actionHero:stats:global',
  }

  api.stats.increment = function(api, key, count, next){
    if(count == null){ count = 1; }
    count = parseFloat(count);
    if(api.redis.enable === true && api.running == true){
      api.redis.client.hincrby(api.stats.collections.local, key, count, function(){
        api.redis.client.hincrby(api.stats.collections.global, key, count, function(){
          if(typeof next == "function"){ process.nextTick(function() { next(null, true); }); }
        });
      });
    }else{
      if(api.stats.data[key] == null){ api.stats.data[key] = 0; }
      api.stats.data[key] = api.stats.data[key] + count;
      if(typeof next == "function"){ process.nextTick(function() { next(null, true); }); }
    }
  }

  api.stats.set = function(api, key, count, next){
    if(count == null){ count = 1; }
    count = parseFloat(count);
    if(api.redis.enable === true && api.running == true){
      api.redis.client.hset(api.stats.collections.local, key, count, function(){
        if(typeof next == "function"){ process.nextTick(function() { next(null, true); }); }
      });
    }else{
      api.stats.data[key] = count;
      if(typeof next == "function"){ process.nextTick(function() { next(null, true); }); }
    }
  }

  api.stats.get = function(api, key, collection, next){
    if(api.redis.enable === true && api.running == true){
      api.redis.client.hget(collection, key, function(err, cacheObj){
        next(err, cacheObj);
      });
    }else{
      next(null, api.stats.data[key]);
    }
  }

  api.stats.getAll = function(api, next){
    if(api.redis.enable === true && api.running == true){
      api.redis.client.hgetall(api.stats.collections.global, function(err, globalStats){
        api.redis.client.hgetall(api.stats.collections.local, function(err, localStats){
          for(var i in localStats){ localStats[i] = parseFloat(localStats[i]); }
          for(var i in globalStats){ globalStats[i] = parseFloat(globalStats[i]); }
          next(err, {global: globalStats, local: localStats});
        });
      });
    }else{
      next(null, api.stats.data);
    }
  }
  
  next();
}

/////////////////////////////////////////////////////////////////////
// exports
exports.initStats = initStats;
