exports.action = {
  name:                   'documentation',
  description:            'documentation',
  blockedConnectionTypes: [],
  outputExample:          {},
  matchExtensionMimeType: false,
  version:                1.0,
  toDocument:             true,

  inputs: {
    required: [],
    optional: [],
  },

  run: function(api, connection, next){    
    connection.response = api.documentation.documentation;
    next(connection, true);
  }
};