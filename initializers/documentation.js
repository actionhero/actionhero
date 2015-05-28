module.exports = {
  loadPriority: 999,
  initialize: function(api, next) {
    var config = api.config;
    var actions = api.actions.actions;

    var actionUrl = 'api' 
    var bindIp = api.utils.getExternalIPAddress()
    var serverPort = null

    if (config.servers.web) {
      serverPort =  config.servers.web.port  
      actionUrl = config.servers.web.urlPathForActions
    }

    var buildPath = function(name, parameters, desc) {
      if (desc == null) { desc = ''; }
      return {
        description: desc,
        operationId: name,
        parameters: parameters,
        responses: {
          "default": {
            description: 'successful operation',
            schema: { items: { $ref: "#/definitions/" + name } }
          }
        }
      };
    };

    api.documentation = {
      documentation: {
        swagger: '2.0',
        info: {
          title: config.general.serverName,
          description: config.general.welcomeMessage,
          version: "" + config.general.apiVersion
        },
        host: bindIp + ':' + serverPort,
        basePath: '/' + actionUrl || 'swagger',
        schemes: ['http'],
        consumes: ['application/json'],
        produces: ['application/json'],
        paths: {},
        definitions: {},
        parameters: {
          apiVersion: {
            name: 'apiVersion',
            "in": 'path',
            required: true,
            type: 'string'
          }
        }
      },
      build: function() {
        // sinple routes 
        var verbs = api.routes.verbs;
        
        for (var i in actions) {
          for (var j in actions[i]) {
            var action = actions[i][j];
            var parameters = [];
            var required = [];

            var definition = this.documentation.definitions[action.name] = {
              properties: {}
            };

            for (var key in action.inputs) {
              this.documentation.parameters[action.name + "_" + key] = {
                name: key, "in": 'query', type: 'string'
              };
              parameters.push({
                $ref: "#/parameters/" + action.name + "_" + key
              });
              definition.properties[key] = {
                type: 'string'
              };
              if (action.inputs[key].required) {
                required.push(key);
              }
            }

            if (required.length > 0) {
              definition.required = required;
            }

            parameters.push({
              name: 'body', "in": 'body', schema: { $ref: "#/definitions/" + action.name }
            });

            if (!this.documentation.paths["/" + action.name]) {
              this.documentation.paths["/" + action.name] = {};
            }

            for (var k = 0, len = verbs.length; k < len; k++) {
              method = verbs[k];
              this.documentation.paths["/" + action.name][method] = buildPath(action.name, parameters, action.description);
            }

          }
        }

        // config routes
        if (api.config.routes) {
          for (var method in api.config.routes) {
            var routes = api.config.routes[method];
            for (var l = 0, len1 = routes.length; l < len1; l++) {
              var route = routes[l]; var parameters = [];

              var path = route.path.replace(/\/:([\w]*)/g, function(match, p1) {
                parameters.push({
                  $ref: "#/parameters/" + route.action + "_" + p1 + "_path"
                });

                api.documentation.documentation.parameters[route.action + "_" + p1 + "_path"] = {
                  name: p1, "in": 'path', type: 'string'
                };

                if (p1 === 'apiVersion') {
                  if (route.apiVersion) {
                    return "/{" + route.apiVersion + "}";
                  }
                  return false;
                } else { return "/{" + p1 + "}"; }
              });

              if (!this.documentation.paths["" + path]) {
                this.documentation.paths["" + path] = {};
              }

              if (method.toLowerCase() === 'all') {
                var verbsLength = verbs.length
                for (var m = 0, verbsLength; m < verbsLength; m++) {
                  this.documentation.paths["" + path][verbs[m]] = buildPath(route.action, parameters);
                }
              } else {
                this.documentation.paths["" + path][method] = buildPath(route.action, parameters);
              }
            }
          }
        }
      }
    };
    next();
  },

  start: function(api, next) {
    api.documentation.build();
    next();
  }
};
