module.exports = {
  loadPriority: 999,
  initialize: function(api, next) {
    var config = api.config;
    var actions = api.actions.actions;

    var actionUrl, bindIp, serverPort;

    if (config.servers.web && config.servers.web.enabled) {
      actionUrl = config.servers.web.urlPathForActions;
      bindIp = config.servers.web.bindIP || 'http://localhost/';
      serverPort = config.servers.web.port || '';
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
      buildPath: function(name, parameters, desc) {
        if (desc == null) {
          desc = '';
        }
        return {
          description: desc,
          operationId: name,
          parameters: parameters,
          responses: {
            "default": {
              description: 'successful operation',
              schema: {
                items: {
                  $ref: "#/definitions/" + name
                }
              }
            }
          }
        };
      },
      build: function() {
        var action, definition, i, input, j, k, key, len, method, parameters, path, ref, ref1, ref2, required, results, route, routes, verb;
        for (i in api.actions.actions) {
          for (j in api.actions.actions[i]) {
            action = api.actions.actions[i][j];
            parameters = [];
            required = [];
            definition = this.documentation.definitions[action.name] = {
              properties: {}
            };
            ref = action.inputs;
            for (key in ref) {
              input = ref[key];
              this.documentation.parameters[action.name + "_" + key] = {
                name: key,
                "in": 'query',
                type: 'string'
              };
              parameters.push({
                $ref: "#/parameters/" + action.name + "_" + key
              });
              definition.properties[key] = {
                type: 'string'
              };
              if (input.required) {
                required.push(key);
              }
            }
            if (required.length > 0) {
              definition.required = required;
            }
            parameters.push({
              name: 'body',
              "in": 'body',
              schema: {
                $ref: "#/definitions/" + action.name
              }
            });
            if (!this.documentation.paths["/" + action.name]) {
              this.documentation.paths["/" + action.name] = {};
            }
            ref1 = api.routes.verbs;
            for (k = 0, len = ref1.length; k < len; k++) {
              method = ref1[k];
              this.documentation.paths["/" + action.name][method] = this.buildPath(action.name, parameters, action.description);
            }
          }
        }
        if (api.config.routes) {
          ref2 = api.config.routes;
          results = [];
          for (verb in ref2) {
            routes = ref2[verb];
            results.push((function() {
              var l, len1, results1;
              results1 = [];
              for (l = 0, len1 = routes.length; l < len1; l++) {
                route = routes[l];
                parameters = [];
                path = route.path.replace(/\/:([\w]*)/g, (function(_this) {
                  return function(match, p1) {
                    parameters.push({
                      $ref: "#/parameters/" + route.action + "_" + p1 + "_path"
                    });
                    _this.documentation.parameters[route.action + "_" + p1 + "_path"] = {
                      name: p1,
                      "in": 'path',
                      type: 'string'
                    };
                    if (p1 === 'apiVersion') {
                      if (route.apiVersion) {
                        return "/{" + route.apiVersion + "}";
                      }
                      return false;
                    } else {
                      return "/{" + p1 + "}";
                    }
                  };
                })(this));
                if (!this.documentation.paths["" + path]) {
                  this.documentation.paths["" + path] = {};
                }
                if (verb.toLowerCase() === 'all') {
                  results1.push((function() {
                    var len2, m, ref3, results2;
                    ref3 = api.routes.verbs;
                    results2 = [];
                    for (m = 0, len2 = ref3.length; m < len2; m++) {
                      method = ref3[m];
                      results2.push(this.documentation.paths["" + path][method] = this.buildPath(route.action, parameters));
                    }
                    return results2;
                  }).call(this));
                } else {
                  results1.push(this.documentation.paths["" + path][verb] = this.buildPath(route.action, parameters));
                }
              }
              return results1;
            }).call(this));
          }
          return results;
        }
      }
    };
    next();
  },
  start: function(api, next) {
    if (api.config.servers.web && api.config.servers.web.enabled) {
      api.documentation.build();
    };
    next();
  }
};
