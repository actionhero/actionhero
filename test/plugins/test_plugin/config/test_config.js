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
        'public': [__dirname + '/../public'],
        'action': [__dirname + '/../actions2']
      },
      test_config: 'Plugin'
    }
  },
  
  servers:{
    websocket: function(api){
      return {
        enabled: false
      }
    }
  }
}
