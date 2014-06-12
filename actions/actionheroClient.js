

exports.action = {
  name:                   'actionheroClient',
  description:            'genertes the browser-facing client library for websockets',
  blockedConnectionTypes: ['socket', 'websocket'],
  outputExample:          {},
  matchExtensionMimeType: true,
  version:                1.0,
  toDocument:             false,

  inputs: {
    required: [],
    optional: [],
  },

  run: function(api, connection, next){
    if(api.config.servers.websocket.enabled !== true){
      connection.error = 'websockets are not enabled on this server'
      next(connection, true);
    }else{
      connection.rawConnection.responseHeaders.push(['Content-Type', 'application/javascript']);
      connection.response = api.servers.servers.websocket.renderClientJS();
      next(connection, true);
    }
  }
};