// You can use many types redis connection packages, including:
// node redis | https://github.com/mranney/node_redis
// fake redis | https://github.com/hdachev/fakeredis
// sentinel redis | https://github.com/ortoo/node-redis-sentinel

exports.default = { 
  redis: function(api){
    return {
      channel: 'actionhero',
      rpcTimeout: 5000,

      package: 'fakeredis',

      // package: 'redis',
      // host: '127.0.0.1',
      // port: 6379,
      // password: null,
      // options: null,
      // database: 0

      // package: 'redis-sentinel-client',
      // port: 26379,
      // host: '127.0.0.1',
      // database: 0,
      // options: {
      //   master_auth_pass: null,
      //   masterName: 'BUS',
      // }
    }
  }
}

exports.test = { 
  redis: function(api){
    var package = 'fakeredis';
    if(process.env.FAKEREDIS == 'false'){
      package = 'redis';
    }

    return {
      'package': package,
      'host': '127.0.0.1',
      'port': 6379,
      'password': null,
      'options': null,
      'database': 2
    }
  }
}