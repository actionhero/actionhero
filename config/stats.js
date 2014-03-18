exports.default = { 
  stats: function(api){
    return {
      // how often should the server write its stats to redis?
      writeFrequency: 1000,
      // what redis key(s) [hash] should be used to store stats?
      //  provide no key if you do not want to store stats
      keys: [
        'actionhero:stats'
      ]
    }
  }
}

exports.test = { 
  stats: function(api){
    return {
      writeFrequency: 0,
      keys: ['test:stats']
    }
  }
}