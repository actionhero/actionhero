exports.showDocumentation = {
  name: 'showDocumentation',
  description: 'return API documentation',
  outputExample: {},

  inputs: {
    required: [],
    optional: [],
  },

  run: function(api, connection, next){    
    connection.response.documentation = api.documentation.documentation;
    next(connection, true);
  }
};