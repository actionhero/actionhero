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
    if(api.redis.enable === true){
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

  api.stats.set = function(key, count, next){
    if(count == null){ count = 1; }
    count = parseFloat(count);
    if(api.redis.enable === true){
      api.redis.client.hset(api.stats.collections.local, key, count, function(err){
        if(typeof next == "function"){ process.nextTick(function() { next(null, true); }); }
      });
    }else{
      api.stats.data[key] = count;
      if(typeof next == "function"){ process.nextTick(function() { next(null, true); }); }
    }
  }

  api.stats.get = function(key, collection, next){
    if(api.redis.enable === true && api.running == true){
      api.redis.client.hget(collection, key, function(err, cacheObj){
        next(err, cacheObj);
      });
    }else{
      next(null, api.stats.data[key]);
    }
  }

  api.stats.getAll = function(next){
    if(api.redis.enable === true && api.running == true){
      api.redis.client.hgetall(api.stats.collections.global, function(err, globalStats){
        api.redis.client.hgetall(api.stats.collections.local, function(err, localStats){
          var statNames = [];
          if(globalStats == null){ globalStats = {}; }
          if(localStats == null){ localStats = {}; }
          for(var i in localStats){ 
            statNames.push(i);
            localStats[i] = parseFloat(localStats[i]); 
          }
          for(var i in globalStats){ 
            statNames.push(i);
            globalStats[i] = parseFloat(globalStats[i]); 
          }
          api.utils.arrayUniqueify(statNames);
          statNames.sort();
          var result = {
            global: {},
            local: {}
          };
          for(var i in statNames){
            var name = statNames[i];
            if(globalStats[name] != null){
              result.global[name] = globalStats[name];
            }
            if(localStats[name] != null){
              result.local[name] = localStats[name];
            }
          }
          next(err, result);
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
exports.stats = stats;
