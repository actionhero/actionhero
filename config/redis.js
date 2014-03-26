exports.default = { 
  redis: function(api){
    return {
      fake: true,
      host: '127.0.0.1',
      port: 6379,
      password: null,
      options: null,
      database: 0
    }
  }
}

exports.test = { 
  redis: function(api){
    var toFakeRedis = true;
    if(process.env.fakeredis == 'false'){
      toFakeRedis = false;
    }
    
    return {
      'fake': toFakeRedis,
      'host': '127.0.0.1',
      'port': 6379,
      'password': null,
      'options': null,
      'DB': 2
    }
  }
}