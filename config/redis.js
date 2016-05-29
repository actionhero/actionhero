var host     = process.env.REDIS_HOST || '127.0.0.1';
var port     = process.env.REDIS_PORT || 6379;
var database = process.env.REDIS_DB   || 0;

exports['default'] = {
  redis: function(api){
    var Redis = require('fakeredis');

    return {
      '_toExpand': false,
      // create the redis clients
      client:     Redis.createClient(port, host),
      subscriber: Redis.createClient(port, host),
      tasks:      Redis.createClient(port, host),
    };
  }
};

exports.test = {
  redis: function(api){
    if(process.env.FAKEREDIS === 'false'){
      var Redis = require('ioredis');
      return {
        '_toExpand': false,

        client:     new Redis({host: host, port: port, db: database}),
        subscriber: new Redis({host: host, port: port, db: database}),
        tasks:      new Redis({host: host, port: port, db: database}),
      };
    }else{
      var Redis = require('fakeredis');
      return {
        '_toExpand': false,

        client:     Redis.createClient(port, host),
        subscriber: Redis.createClient(port, host),
        tasks:      Redis.createClient(port, host),
      };
    }
  }
};
