exports.swaggerDocumentation = {
  name: 'swaggerDocumentation',
  description: 'Returns Swagger Documentation',
  outputExample: 'Swagger JSON',

  run: function(api, data, next) {
  	if (api.config.servers.web && api.config.servers.web.enabled &&  api.config.servers.web.swaggerEnabled) {
      data.response = api.swagger.actionToSwagger;
    };
    next();
  }
  
};
