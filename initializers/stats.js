var stats = function(api, next){
  api.stats = {};
  api.stats.timer = null;
  api.stats.pendingIncrements = {};

  api.stats._start = function(api, next){
    if(api.config.stats.writeFrequency > 0){
      setTimeout(api.stats.writeIncrements, api.config.stats.writeFrequency);
    }
    next();
  }

  api.stats._teardown = function(api, next){
    clearTimeout(api.stats.timer);
    next();
  }

  api.stats.increment = function(key, count){
    if(null === count){ count = 1 }
    count = parseFloat(count);
    if(null === api.stats.pendingIncrements[key]){ api.stats.pendingIncrements[key] = 0 }
    api.stats.pendingIncrements[key] = api.stats.pendingIncrements[key] + count;
  }

  api.stats.writeIncrements = function(next){
    clearTimeout(api.stats.timer);
    // api.log('writing pending stats data', 'debug', api.stats.pendingIncrements);
    if(api.utils.hashLength(api.stats.pendingIncrements) > 0 && api.config.stats.keys.length > 0){
      var started = 0;
      var pendingIncrements = api.utils.objClone(api.stats.pendingIncrements);
      api.stats.pendingIncrements = {};
      for(var i in api.config.stats.keys){
        started++;
        var collection = api.config.stats.keys[i];
        (function(collection){
          var multi = api.redis.client.multi();
          for(var key in pendingIncrements){
            var value = pendingIncrements[key];
            multi.hincrby(collection, key, value);
          }
          multi.exec(function(){
            started--;
            if(0 === started){
              setTimeout(api.stats.writeIncrements, api.config.stats.writeFrequency);
              if('function' === typeof next){ next() }
            }
          });
        })(collection);
      }
    } else {
      setTimeout(api.stats.writeIncrements, api.config.stats.writeFrequency );
      if('function' === typeof next){ next() }
    }
  }

  api.stats.get = function(key, collection, next){
    if(null === next && 'function' === typeof collection){ next = collection; collection = null; }
    if(null === collection){ collection = api.config.stats.keys[0] }
    api.redis.client.hget(collection, key, function(err, value){
      next(err, value);
    });
  }

  api.stats.getAll = function(collections, next){
    if(null === next && 'function' === typeof collections){ next = collections; collections = null; }
    if(null === collections){ collections = api.config.stats.keys }

    var results = {};
    if(0 === collections.length){
      next(null, results);
    } else {
      for(var i in collections){
        var collection = collections[i];
        (function(collection){
          api.redis.client.hgetall(collection, function(err, data){
            if(null === data){ data = {} }
            results[collection] = data;
            if(api.utils.hashLength(results) == collections.length){
              next(err, results);
            }
          });
        })(collection);
      }
    }
  }
  
  next();
}

/////////////////////////////////////////////////////////////////////
// exports
exports.stats = stats;
