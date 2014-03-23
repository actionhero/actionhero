exports.action = {
  name:                   'debug',
  description:            'debug',
  blockedConnectionTypes: [],
  outputExample:          {},
  matchExtensionMimeType: false,
  version:                1.0,
  toDocument:             true,

  inputs: {
    required: [],
    optional: ['data', 'thing', 'stuff'],
  },

  run: function(api, connection, next){
    // console.log(connection)
    
    connection.response.id          = connection.id;
    connection.response.remotePort  = connection.remotePort;
    connection.response.remoteIP    = connection.remoteIP;
    connection.response.connectedAt = connection.connectedAt;
    connection.response.params      = connection.params;
    connection.response.type        = connection.type;
    connection.response.room        = connection.room;

    next(connection, true);
  }
};