exports.default = {
  redis: function(api){
    var redisDetails = {
      // Which channel to use on redis pub/sub for RPC communication
      channel: 'actionhero',
      // How long to wait for an RPC call before considering it a failure
      rpcTimeout: 5000,
      // which redis package should you ise?
      pkg: 'fakeredis',

      // Basic configuration options
      host     : process.env.REDIS_HOST || '127.0.0.1',
      port     : process.env.REDIS_PORT || 6379,
      database : process.env.REDIS_DB   || 0,
    };

    if( process.env.FAKEREDIS === 'false' || process.env.REDIS_HOST !== undefined ){
      redisDetails.pkg  = 'ioredis';
      // there are many more connection options, including support for cluster and sentinel
      // learn more @ https://github.com/luin/ioredis
      redisDetails.options  = {
        password: (process.env.REDIS_PASS || null),
      };
    }

    return redisDetails;
  }
};

exports.test = {
  redis: function(api){
    var pkg = 'fakeredis';
    if(process.env.FAKEREDIS === 'false'){
      pkg = 'ioredis';
    }

    return {
      pkg: pkg,
      host: '127.0.0.1',
      port: 6379,
      database: 2,
      options: {},
    };
  }
};
