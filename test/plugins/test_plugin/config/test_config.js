exports.default = {
  test: function(api){
    return {
      config: 'OK'
    }
  },
  
  
  general: function(api){
    return {
      serverName: 'actionhero API (Plugin)',
      paths: {
        'action': [ __dirname + '/../actions2' ] 
      },
      test_config: 'Plugin'
    }
  }
}