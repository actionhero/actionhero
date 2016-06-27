'use strict';

var fs = require('fs');
var async = require('async');

module.exports = {
  startPriority: 300,
  loadPriority:  300,
  initialize: function(api, next){

    api.cache = {};
    api.cache.redisPrefix  = api.config.general.cachePrefix;
    api.cache.lockPrefix   = api.config.general.lockPrefix;
    api.cache.lockDuration = api.config.general.lockDuration;
    api.cache.lockName     = api.id;
    api.cache.lockRetry    = 100;

    var redis = api.redis.clients.client;

    api.cache.keys = function(callback){
      redis.keys(api.cache.redisPrefix + '*', callback);
    };

    api.cache.locks = function(callback){
      redis.keys(api.cache.lockPrefix + '*', callback);
    };

    api.cache.size = function(callback){
      api.cache.keys(function(error, keys){
        var length = 0;
        if(keys){ length = keys.length; }
        callback(error, length);
      });
    };

    api.cache.clear = function(callback){
      api.cache.keys(function(error, keys){
        if(error && typeof callback === 'function'){ return callback(error); }
        var jobs = [];
        keys.forEach(function(key){
          jobs.push(function(done){ redis.del(key, done); });
        });

        async.parallel(jobs, function(error){
          if(typeof callback === 'function'){ return callback(error); }
        });
      });
    };

    api.cache.dumpWrite = function(file, callback){
      var data = {};
      api.cache.keys(function(error, keys){
        if(error && typeof callback === 'function'){ return callback(error); }
        var jobs = [];
        keys.forEach(function(key){
          jobs.push(function(done){
            redis.get(key, function(error, content){
              if(error){ return done(error); }
              data[key] = content;
              return done();
            });
          });
        });

        async.parallel(jobs, function(error){
          if(error){
            if(typeof callback === 'function'){ return callback(error); }
          }else{
            fs.writeFileSync(file, JSON.stringify(data));
            if(typeof callback === 'function'){ return callback(null, keys.length); }
          }
        });
      });
    };

    api.cache.dumpRead = function(file, callback){
      api.cache.clear(function(error){
        if(error){
          if(typeof callback === 'function'){ return callback(error); }
        }else{
          var jobs = [];
          try{
            var data = JSON.parse(fs.readFileSync(file));
          }catch(error){ return callback(error); }

          Object.keys(data).forEach(function(key){
            var content = data[key];
            jobs.push(function(done){ api.cache.saveDumpedElement(key, content, done); });
          });

          async.series(jobs, function(error){
            if(typeof callback === 'function'){ return callback(error, Object.keys(data).length); }
          });
        }
      });
    };

    api.cache.saveDumpedElement = function(key, content, callback){
      try{
        var parsedContent = JSON.parse(content);
      }catch(error){ return callback(error); }

      redis.set(key, content, function(error){
        if(error){ return callback(error); }
        else if(parsedContent.expireTimestamp){
          var expireTimeSeconds = Math.ceil((parsedContent.expireTimestamp - new Date().getTime()) / 1000);
          redis.expire(key, expireTimeSeconds, function(){
            return callback(error);
          });
        }else{
          return callback();
        }
      });
    };

    api.cache.load = function(key, options, callback){
      // optons: options.expireTimeMS, options.retry
      if(typeof options === 'function'){
        callback = options;
        options = {};
      }

      redis.get(api.cache.redisPrefix + key, function(error, cacheObj){
        if(error){ api.log(error, 'error'); }
        try{ cacheObj = JSON.parse(cacheObj); }catch(e){}
        if(!cacheObj){
          if(typeof callback === 'function'){
            return callback(new Error(api.i18n.localize('Object not found')), null, null, null, null);
          }
        }else if(cacheObj.expireTimestamp >= new Date().getTime() || cacheObj.expireTimestamp === null){
          var lastReadAt = cacheObj.readAt;
          var expireTimeSeconds;
          cacheObj.readAt = new Date().getTime();
          if(cacheObj.expireTimestamp){
            if(options.expireTimeMS){
              cacheObj.expireTimestamp = new Date().getTime() + options.expireTimeMS;
              expireTimeSeconds = Math.ceil(options.expireTimeMS / 1000);
            }else{
              expireTimeSeconds = Math.floor((cacheObj.expireTimestamp - new Date().getTime()) / 1000);
            }
          }

          api.cache.checkLock(key, options.retry, function(error, lockOk){
            if(error || lockOk !== true){
              if(typeof callback === 'function'){ return callback(new Error(api.i18n.localize('Object Locked'))); }
            }else{
              redis.set(api.cache.redisPrefix + key, JSON.stringify(cacheObj), function(error){
                if(typeof callback === 'function' && typeof expireTimeSeconds !== 'number'){
                  return callback(error, cacheObj.value, cacheObj.expireTimestamp, cacheObj.createdAt, lastReadAt);
                }else{
                  redis.expire(api.cache.redisPrefix + key, expireTimeSeconds, function(error){
                    if(typeof callback === 'function'){ return callback(error, cacheObj.value, cacheObj.expireTimestamp, cacheObj.createdAt, lastReadAt); }
                  });
                }
              });
            }
          });
        }else{
          if(typeof callback === 'function'){
            return callback(new Error(api.i18n.localize('Object Expired')));
          }
        }
      });
    };

    api.cache.destroy = function(key, callback){
      api.cache.checkLock(key, null, function(error, lockOk){
        if(error || lockOk !== true){
          if(typeof callback === 'function'){ callback(new Error(api.i18n.localize('Object Locked'))); }
        }else{
          redis.del(api.cache.redisPrefix + key, function(error, count){
            if(error){ api.log(error, 'error'); }
            var resp = true;
            if(count !== 1){ resp = false; }
            if(typeof callback === 'function'){ callback(error, resp); }
          });
        }
      });
    };

    api.cache.save = function(key, value, expireTimeMS, callback){
      if(typeof expireTimeMS === 'function' && typeof callback === 'undefined'){
        callback = expireTimeMS;
        expireTimeMS = null;
      }

      var expireTimeSeconds = null;
      var expireTimestamp = null;
      if(expireTimeMS !== null){
        expireTimeSeconds = Math.ceil(expireTimeMS / 1000);
        expireTimestamp   = new Date().getTime() + expireTimeMS;
      }

      var cacheObj = {
        value:           value,
        expireTimestamp: expireTimestamp,
        createdAt:       new Date().getTime(),
        readAt:          null
      };

      api.cache.checkLock(key, null, function(error, lockOk){
        if(error || lockOk !== true){
          if(typeof callback === 'function'){ return callback(new Error(api.i18n.localize('Object Locked'))); }
        }else{
          redis.set(api.cache.redisPrefix + key, JSON.stringify(cacheObj), function(error){
            if(!error && expireTimeSeconds){
              redis.expire(api.cache.redisPrefix + key, expireTimeSeconds, function(error){
                if(typeof callback === 'function'){ return callback(error, true); }
              });
            }else{
              if(typeof callback === 'function'){ return callback(error, true); }
            }
          });
        }
      });
    };

    api.cache.push = function(key, item, callback){
      var object = JSON.stringify({data: item});
      redis.rpush(api.cache.redisPrefix + key, object, function(error){
        if(typeof callback === 'function'){ callback(error); }
      });
    };

    api.cache.pop = function(key, callback){
      redis.lpop(api.cache.redisPrefix + key, function(error, object){
        if(error){ return callback(error); }
        if(!object){ return callback(); }
        var item;
        try{
          item = JSON.parse(object);
        }catch(error){ return callback(error); }
        return callback(null, item.data);
      });
    };

    api.cache.listLength = function(key, callback){
      redis.llen(api.cache.redisPrefix + key, callback);
    };

    api.cache.lock = function(key, expireTimeMS, callback){
      if(typeof expireTimeMS === 'function' && callback === null){
        expireTimeMS = expireTimeMS;
        expireTimeMS = null;
      }
      if(expireTimeMS === null){
        expireTimeMS = api.cache.lockDuration;
      }

      api.cache.checkLock(key, null, function(error, lockOk){
        if(error || lockOk !== true){
          return callback(error, false);
        }else{
          redis.setnx(api.cache.lockPrefix + key, api.cache.lockName, function(error){
            if(error){
              return callback(error);
            }else{
              redis.expire(api.cache.lockPrefix + key, Math.ceil(expireTimeMS / 1000), function(error){
                lockOk = true;
                if(error){ lockOk = false; }
                return callback(error, lockOk);
              });
            }
          });
        }
      });
    };

    api.cache.unlock = function(key, callback){
      api.cache.checkLock(key, null, function(error, lockOk){
        if(error || lockOk !== true){
          return callback(error, false);
        }else{
          redis.del(api.cache.lockPrefix + key, function(error){
            lockOk = true;
            if(error){ lockOk = false; }
            return callback(error, lockOk);
          });
        }
      });
    };

    api.cache.checkLock = function(key, retry, callback, startTime){
      if(startTime === null){ startTime = new Date().getTime(); }

      redis.get(api.cache.lockPrefix + key, function(error, lockedBy){
        if(error){
          return callback(error, false);
        }else if(lockedBy === api.cache.lockName || lockedBy === null){
          return callback(null, true);
        }else{
          var delta = new Date().getTime() - startTime;
          if(retry === null || retry === false || delta > retry){
            return callback(null, false);
          }else{
            return setTimeout(function(){
              api.cache.checkLock(key, retry, callback, startTime);
            }, api.cache.lockRetry);
          }
        }
      });
    };

    next();
  }
};
