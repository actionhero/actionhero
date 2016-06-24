var host     = process.env.REDIS_HOST || '127.0.0.1';
var port     = process.env.REDIS_PORT || 6379;
var database = process.env.REDIS_DB   || 0;
var password = process.env.REDIS_PASS || null;

exports['default'] = {
  redis: function(api){
    var Redis;
    var client;
    var subscriber;
    var tasks;

    // cleanup if we are rebooting or looing in config load
    if(api.config.redis){
      if(api.config.redis.client){     api.config.redis.client.quit();     }
      if(api.config.redis.subscriber){ api.config.redis.subscriber.quit(); }
      if(api.config.redis.tasks){      api.config.redis.tasks.quit();      }
    }

    if(process.env.FAKEREDIS === 'false' || process.env.REDIS_HOST !== undefined){
      Redis = require('ioredis');
      client     = new Redis({ port: port, host: host, password: password, db: database });
      subscriber = new Redis({ port: port, host: host, password: password, db: database });
      tasks      = new Redis({ port: port, host: host, password: password, db: database });
    }else{
      Redis = require('fakeredis');
      client     = Redis.createClient(port, host, {fast: true});
      subscriber = Redis.createClient(port, host, {fast: true});
      tasks      = Redis.createClient(port, host, {fast: true});
    }

    return {
      '_toExpand': false,
      // create the redis clients
      client:     client,
      subscriber: subscriber,
      tasks:      tasks,
    };
  }
};
