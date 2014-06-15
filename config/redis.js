// You can use many types redis connection packages, including:
// node redis | https://github.com/mranney/node_redis
// fake redis | https://github.com/hdachev/fakeredis
// sentinel redis | https://github.com/ortoo/node-redis-sentinel

exports.default = { 
  redis: function(api){
    return {
      // Which channel to use on redis pub/sub for RPC communication
      channel: 'actionhero',
      // How long to wait for an RPC call before considering it a failure 
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