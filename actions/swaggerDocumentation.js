exports.swaggerDocumentation = {
  name: 'swaggerDocumentation',
  description: 'Returns Swagger Documentation',
  outputExample: 'Swagger JSON',

  run: function(api, data, next) {
    data.response = api.swagger.actionToSwagger;
    next();
  }
  
};
