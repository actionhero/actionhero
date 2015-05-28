exports.showDocumentation = {
  name: 'showDocumentation',
  description: 'Returns Swagger Documentation',
  outputExample: 'Swagger JSON',

  run: function(api, data, next) {
    data.response = api.documentation.documentation;
    next();
  }
  
};
