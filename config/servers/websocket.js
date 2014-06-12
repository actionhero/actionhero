// Note that to use the websocket server, you also need the web server enabled

exports.default = { 
  servers: {
    websocket: function(api){
      return {
        enabled:       true,
        clientUrl:     'window.location.origin', // you can pass a FQDN here, or function to be called / window object to be inspected

        // Primus Server Options: 
        server: {
          // authorization: null,
          // pathname:      '/primus',
          // parser:        'JSON',
          // transformer:   'websockets',
          // plugin:        {},
          // timeout:       35000,
          // origins:       '*',
          // methods:       ['GET','HEAD','PUT','POST','DELETE','OPTIONS'],
          // credentials:   true,
          // maxAge:        '30 days',
          // headers:       false,
          // exposed:       false,
        },

        // Priumus Client Options: 
        client: {
          // reconnect:        {},
          // timeout:          10000,
          // ping:             25000,
          // pong:             10000,
          // strategy:         "online",
          // manual:           false,
          // websockets:       true,
          // network:          true,
          // transport:        {},
          // queueSize:        Infinity,
        },
      }
    }
  }
}