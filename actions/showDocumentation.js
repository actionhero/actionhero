exports.showDocumentation = {
  name: 'showDocumentation',
  description: 'return API documentation',

  run: function(api, connection, next){    
    connection.response.documentation = api.documentation.documentation;
    next(connection, true);
  }
};