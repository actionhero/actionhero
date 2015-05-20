exports.showDocumentation = {
  name: 'showDocumentation',
  description: 'Returns Swagger Documentation',
  outputExample: 'Swagger JSON',

  run: function(api, data, next) {
  	if (api.config.servers.web && api.config.servers.web.enabled) {
      data.response = api.documentation.documentation;
    };
    next();
  }
  
};
