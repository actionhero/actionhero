// STUB AH Config for testing with a loaded plugin

exports.default = {
  general: function(api){
    return {
      paths: {
        'plugin': [ __dirname + '/..' ],
        'action': [ __dirname + '/../application_actions' ],
        'public': [ __dirname + '/../application_public' ],
      },
      
      // for this test, we load the plugin which is located here: /test/plugin/test_plugin
      plugins: [
        'test_plugin'
      ],
      
      test_config: 'Application'
    }
  }
}