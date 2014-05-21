var fs = require('fs');

var cache = function(api, next){

  api.cache = {};
  api.cache.sweeperTimer = null;
  api.cache.sweeperTimeout = 60 * 1000;
  api.cache.redisPrefix = api.config.general.cachePrefix;

  api.cache._start = function(api, callback){
    api.cache.size(function(err, count){
      if(err != null){
        api.log('error connecting to the cache: ' + String(e), 'fatal');
      }
      api.log('connected to the cache with ' + count + ' existing objects', 'debug');
      callback();
    });
  }

  api.cache.keys = function(next){
    api.redis.client.keys(api.cache.redisPrefix + "*", function(err, keys){
      next(err, keys);
    });
  }
 
  api.cache.size = function(next){
    api.cache.keys(function(err, keys){
      var length = 0;
      if(keys != null){
        length = keys.length;
      }
      next(null, length);
    });
  }

  api.cache.clear = function(next){
    api.cache.keys(function(err, keys){
      if(keys.length > 0){
        var stared = 0;
        keys.forEach(function(key){
          stared++;
          api.redis.client.del(key, function(err){
            stared--;
            if(stared === 0){
              if(typeof next === 'function'){ next(err, keys.length); }
            }
          });
        });
      }else{
        if(typeof next === 'function'){ next(err, keys.length); }
      }
    });
  }

  api.cache.dumpWrite = function(file, next){
    api.cache.keys(function(err, keys){
      var data = {};
      var stared = 0;
      keys.forEach(function(key){
        stared++;
        api.redis.client.get(key, function(err, content){
          stared--;
          data[key] = content;
          if(stared === 0){
            fs.writeFileSync(file, JSON.stringify(data));
            if(typeof next === 'function'){ next(err, keys.length); }
          }
        });
      });
      if(keys.length === 0){
        fs.writeFileSync(file, JSON.stringify(data));
        if(typeof next === 'function'){ next(err, keys.length); }
      }
    });
  }

  api.cache.dumpRead = function(file, next){
    api.cache.clear(function(err){
      var stared = 0;
      var data = JSON.parse( fs.readFileSync(file) );
      for(var key in data){
        stared++;
        (function(key){
          var content = data[key];
          var parsedContent = JSON.parse(content);
          api.redis.client.set(key, content, function(err){
            if(parsedContent.expireTimestamp != null){
              var expireTimeSeconds = Math.ceil((parsedContent.expireTimestamp - new Date().getTime()) / 1000);
              api.redis.client.expire(key, expireTimeSeconds);
            }
            stared--;
            if(stared === 0){
              if(typeof next === 'function'){ next(err, api.utils.hashLength(data)); }
            }
          });
        })(key)
      }
      if(api.utils.hashLength(data) === 0){
        if(typeof next === 'function'){ next(err, api.utils.hashLength(data)); }
      }
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
    if(null != expireTimeMS){
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
