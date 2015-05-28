'use strict';
angular.module('ah.client', []).factory('ahClient', ["$q", "$sce", function($q, $sce) {
  var client, connect, connected;
  client = new ActionheroClient;
  connected = null;
  connect = function() {
    if (!connected) {
      connected = $q.defer();
      client.connect(function(error, details) {
        connected.resolve({
          error: error,
          details: details
        });
      });
    }
    return connected.promise;
  };
  return {
    chat: function(room, callback) {
      var self;
      self = this;
      self.client = client;
      self.messages = [];
      self.error = null;
      self.details = {};
      self.callback = callback;
      self.room = room;
      if (!connected) {
        self.client.on('welcome', function(message) {
          self.messages.push({
            from: 'ActionHero',
            message: $sce.trustAsHtml('<div style="text-align: center">' + message.welcome + '<br><img src="/public/logo/actionhero.png" width="100"/></div>'),
            sentAt: Date.now()
          });
        });
        self.client.on('connected', function() {
          self.callback();
        });
        self.client.on('disconnected', function() {
          self.callback();
        });
        self.client.on('alert', function(message) {
          window.alert(JSON.stringify(message));
        });
        self.client.on('api', function(message) {
          window.alert(JSON.stringify(message));
        });
        self.client.on('say', function(message) {
          if (message.from === self.client.id) {
            message.isMe = true;
          }
          message.message = $sce.trustAsHtml(message.message);
          self.messages.push(message);
          self.callback();
        });
      }
      connect().then(function(data) {
        if (data.error) {
          self.error = data.error;
        } else {
          self.details = data.details;
          self.client.roomAdd(room);
        }
      });
      return {
        messages: self.messages,
        leave: function() {
          self.client.roomLeave(self.room);
        },
        say: function(message) {
          self.client.say(self.room, message);
          self.messages.push({
            sentAt: (new Date).getTime(),
            message: message,
            from: '*me*'
          });
        }
      };
    },
    runAction: function(action, version, params) {
      var defer;
      if (version == null) {
        version = null;
      }
      if (params == null) {
        params = {};
      }
      defer = $q.defer();
      params.apiVersion = version;
      connect().then(function() {
        client.action(action, params, function(response) {
          defer.resolve(response);
        });
      });
      return defer.promise;
    }
  };
}]);

'use strict';

angular.module('ah', ['ui.router', 'ah.server', 'ah.chat', 'ah.swagger', 'ah.client']).config(["$stateProvider", "$urlRouterProvider", "$compileProvider", function($stateProvider, $urlRouterProvider, $compileProvider) {
  $compileProvider.debugInfoEnabled(true);
  $urlRouterProvider.otherwise('/');
  $stateProvider.state('ah', {
    abstract: true,
    url: '',
    templateUrl: 'views/app.html'
  }).state('ah.intro', {
    url: '/',
    templateUrl: 'views/intro.html'
  }).state('ah.server', {
    url: '/server',
    templateUrl: 'views/server.html',
    controller: 'ahServer'
  }).state('ah.chat', {
    url: '/chat',
    templateUrl: 'views/chat.html',
    controllerAs: 'chat',
    controller: 'ahChat'
  }).state('ah.swagger', {
    url: '/swagger',
    templateUrl: 'views/swagger.html',
    controller: 'swaggerCtrl'
  });
}]);

'use strict';

angular.module('ah.chat', []).directive('ahChatMessage', function() {
  return {
    restrict: 'E',
    replace: true,
    template: '<li class="chat-message" ng-class="{ \'me\' : message.isMe }">\n  <div class="username">\n    <span class="">{{message.from | limitTo: 10}}</span>\n  </div>\n  <div class="message">\n    <p ng-bind-html="message.message"></p>\n    <span class="msg-time">{{message.sentAt | formatTime}}</span>\n  </div>\n</li>'
  };
}).controller('ahChat', ["$scope", "ahClient", function($scope, ahClient) {
  $scope.ahClient = ahClient.chat('defaultRoom', function() {
    $scope.$apply();
  });
  $scope.writingMessage = '';
  $scope.submitFunction = function() {
    $scope.ahClient.say($scope.writingMessage);
    $scope.writingMessage = '';
  };
  $scope.$on('$destroy', function() {
    $scope.ahClient.leave();
  });
}]).filter('formatTime', function() {
  return function(input) {
    return new Date(input).toLocaleTimeString();
  };
});

'use strict';

angular.module('ah.server', []).controller('ahServer', ["$scope", "$interval", "$http", function($scope, $interval, $http) {
  var refresh;
  refresh = $interval(function() {
    $scope.isLoading = true;
    $http.get('api/status').then(function(response) {
      var key, keys, ref, value;
      $scope.data = response.data;
      $scope.stats = {};
      ref = response.data.stats['actionhero:stats'];
      for (keys in ref) {
        value = ref[keys];
        key = keys.split(':');
        if (!$scope.stats[key[0]]) {
          $scope.stats[key[0]] = {};
        }
        $scope.stats[key[0]][key[1]] = value;
      }
      $scope.isLoading = false;
    });
  }, 3000);
  $scope.getMinutes = function(ts) {
    return Math.round(ts / 1000 / 60) + ' min';
  };
  $scope.$on('$destroy', function() {
    $interval.cancel(refresh);
  });
}]);

'use strict';

angular.module('ah.swagger', []).directive('swaggerContent', function() {
  return {
    replace: true,
    templateUrl: 'views/swagger/content.html'
  };
}).directive('swaggerHeading', function() {
  return {
    replace: true,
    templateUrl: 'views/swagger/heading.html'
  };
}).directive('swaggerParameter', function() {
  return {
    restrict: 'A',
    templateUrl: 'views/swagger/parameter.html'
  };
}).directive('swaggerResponse', function() {
  return {
    restrict: 'A',
    templateUrl: 'views/swagger/response.html'
  };
}).controller('swaggerCtrl', ["$scope", "$http", "$sce", "swaggerModel", "swaggerClient", function($scope, $http, $sce, swaggerModel, swaggerClient) {
  var swagger;
  swagger = null;
  $http.get('api/showDocumentation').success(function(data) {
    var code, form, getParameter, httpMethod, i, j, k, l, map, operation, operationId, operations, param, paramId, params, path, res, resources, resp, tag;
    swagger = data;
    operationId = 0;
    paramId = 0;
    map = {};
    form = {};
    resources = [];
    if (!swagger.tags) {
      resources.push({
        name: 'default',
        open: true
      });
      map['default'] = 0;
    } else {
      i = 0;
      l = swagger.tags.length;
      while (i < l) {
        tag = swagger.tags[i];
        resources.push(tag);
        map[tag.name] = i;
        i++;
      }
    }
    getParameter = function(param) {
      return param.$ref.replace('#/parameters/', '');
    };
    for (path in swagger.paths) {
      for (httpMethod in swagger.paths[path]) {
        operation = swagger.paths[path][httpMethod];
        operation.id = operationId;
        form[operationId] = {
          contentType: operation.consumes && operation.consumes.length === 1 ? operation.consumes[0] : 'application/json',
          responseType: 'application/json'
        };
        operation.httpMethod = httpMethod;
        operation.path = path;
        j = 0;
        params = operation.parameters || [];
        k = params.length;
        while (j < k) {
          param = params[j];
          if (param.$ref) {
            angular.extend(param, swagger.parameters[getParameter(param)]);
          }
          param.id = paramId;
          param.type = 'string';
          param.subtype = param.type;
          form[operationId][param.name] = param["default"] || '';
          if (param.schema) {
            param.schema.display = 1;
            param.schema.json = swaggerModel.generateSampleJson(swagger, param.schema);
            param.schema.model = $sce.trustAsHtml(swaggerModel.generateModel(swagger, param.schema));
          }
          if (param["in"] === 'body') {
            operation.consumes = operation.consumes || ['application/json'];
          }
          paramId++;
          j++;
        }
        if (operation.responses) {
          for (code in operation.responses) {
            resp = operation.responses[code];
            resp.description = $sce.trustAsHtml(resp.description);
            if (resp.schema) {
              resp.schema.json = swaggerModel.generateSampleJson(swagger, resp.schema);
              if (resp.schema.type === 'object' || resp.schema.$ref) {
                resp.display = 1;
                resp.schema.model = $sce.trustAsHtml(swaggerModel.generateModel(swagger, resp.schema));
              } else if (resp.schema.type === 'string') {
                delete resp.schema;
              }
              if (code === '200' || code === '201') {
                operation.responseClass = resp;
                operation.responseClass.display = 1;
                operation.responseClass.status = code;
                delete operation.responses[code];
              } else {
                operation.hasResponses = true;
              }
            } else {
              operation.hasResponses = true;
            }
          }
        }
        operation.tags = operation.tags || ['default'];
        tag = operation.tags[0];
        if (typeof map[tag] === 'undefined') {
          map[tag] = resources.length;
          resources.push({
            name: tag
          });
        }
        res = resources[map[operation.tags[0]]];
        res.operations = res.operations || [];
        res.operations.push(operation);
        operationId++;
      }
    }
    while (i < resources.length) {
      operations = resources[i].operations;
      if (!operations || operations && operations.length === 0) {
        resources.splice(i, 1);
      }
      i++;
    }
    resources.sort(function(a, b) {
      if (a.name > b.name) {
        return 1;
      } else if (a.name < b.name) {
        return -1;
      }
      return 0;
    });
    swaggerModel.clearCache();
    $scope.form = form;
    $scope.parameters = swagger.parameters;
    $scope.resources = resources;
  });
  $scope.submitTryIt = function(operation) {
    operation.loading = true;
    swaggerClient.send(swagger, operation, $scope.form[operation.id], $scope.transformTryIt).then(function(result) {
      operation.loading = false;
      operation.tryItResult = result;
    });
  };
}]).service('swaggerClient', ["$q", "$http", function($q, $http) {
  var formatResult;
  formatResult = function(deferred, data, status, headers, config) {
    var key, parts, query;
    query = '';
    if (config.params) {
      parts = [];
      for (key in config.params) {
        parts.push(key + '=' + encodeURIComponent(config.params[key]));
      }
      if (parts.length > 0) {
        query = '?' + parts.join('&');
      }
    }
    deferred.resolve({
      url: config.url + query,
      response: {
        body: data ? (angular.isString(data) ? data : angular.toJson(data, true)) : 'no content',
        status: status,
        headers: angular.toJson(headers(), true)
      }
    });
  };
  this.send = function(swagger, operation, values, transform) {
    var callback, deferred, headers, i, l, param, params, path, query, request, value;
    deferred = $q.defer();
    query = {};
    headers = {};
    path = operation.path;
    i = 0;
    params = operation.parameters || [];
    l = params.length;
    while (i < l) {
      param = params[i];
      value = values[param.name];
      switch (param["in"]) {
        case 'query':
          if (!!value) {
            query[param.name] = value;
          }
          break;
        case 'path':
          path = path.replace('{' + param.name + '}', encodeURIComponent(value));
          break;
        case 'header':
          if (!!value) {
            headers[param.name] = value;
          }
          break;
        case 'formData':
          values.body = values.body || new FormData;
          if (!!value) {
            if (param.type === 'file') {
              values.contentType = void 0;
            }
            values.body.append(param.name, value);
          }
      }
      i++;
    }
    headers.Accept = values.responseType;
    headers['Content-Type'] = values.body ? values.contentType : 'text/plain';
    request = {
      method: operation.httpMethod,
      url: [swagger.schemes && swagger.schemes[0] || 'http', '://', swagger.host, swagger.basePath || '', path].join(''),
      headers: headers,
      data: values.body,
      params: query
    };
    callback = function(data, status, headers, config) {
      formatResult(deferred, data, status, headers, config);
    };
    if (typeof transform === 'function') {
      transform(request);
    }
    $http(request).success(callback).error(callback);
    return deferred.promise;
  };
}]).service('swaggerModel', function() {
  var countInLine, generateModel, getClassName, getSampleObj, modelCache, objCache;
  objCache = {};
  modelCache = {};
  getClassName = function(schema) {
    return schema.$ref.replace('#/definitions/', '');
  };
  getSampleObj = function(swagger, schema) {
    var def, name, sample;
    sample = void 0;
    if (schema.properties) {
      sample = {};
      for (name in schema.properties) {
        sample[name] = getSampleObj(swagger, schema.properties[name]);
      }
    } else if (schema.$ref) {
      def = swagger.definitions && swagger.definitions[getClassName(schema)];
      if (def) {
        if (!objCache[schema.$ref]) {
          objCache[schema.$ref] = getSampleObj(swagger, def);
        }
        sample = objCache[schema.$ref];
      }
    } else if (schema.type === 'object') {
      sample = {};
    } else {
      sample = 'string';
    }
    return sample;
  };
  this.generateSampleJson = function(swagger, schema) {
    return angular.toJson(getSampleObj(swagger, schema), true);
  };
  countInLine = 0;
  generateModel = this.generateModel = function(swagger, schema, modelName) {
    var buffer, className, def, isRequired, model, name, property, propertyName, submodels;
    model = '';
    isRequired = function(item, name) {
      return item.required && item.required.indexOf(name) !== -1;
    };
    if (schema.properties) {
      modelName = modelName || 'Inline Model' + countInLine++;
      buffer = ['<div><strong>' + modelName + ' {</strong>'];
      submodels = [];
      for (propertyName in schema.properties) {
        property = schema.properties[propertyName];
        buffer.push('<div class="pad"><strong>', propertyName, '</strong> (<span class="type">');
        if (property.properties) {
          name = 'Inline Model' + countInLine++;
          buffer.push(name);
          submodels.push(generateModel(swagger, property, name));
        } else if (property.$ref) {
          buffer.push(getClassName(property));
          submodels.push(generateModel(swagger, property));
        } else {
          buffer.push('string');
        }
        buffer.push('</span>');
        if (!isRequired(schema, propertyName)) {
          buffer.push(', ', '<em>optional</em>');
        }
        buffer.push(')');
        if (property.description) {
          buffer.push(': ', property.description);
        }
      }
      buffer.pop();
      buffer.push('</div>');
      buffer.push('<strong>}</strong>');
      buffer.push(submodels.join(''), '</div>');
      model = buffer.join('');
    } else if (schema.$ref) {
      className = getClassName(schema);
      def = swagger.definitions && swagger.definitions[className];
      if (def) {
        if (!modelCache[schema.$ref]) {
          modelCache[schema.$ref] = generateModel(swagger, def, className);
        }
        model = modelCache[schema.$ref];
      }
    } else if (schema.type === 'object') {
      model = '<strong>Inline Model {<br>}</strong>';
    }
    return model;
  };
  this.clearCache = function() {
    objCache = {};
    modelCache = {};
  };
});

angular.module('ah').run(['$templateCache', function($templateCache) {
  'use strict';

  $templateCache.put('index.html',
    "<!doctype html>\n" +
    "\n" +
    "<html lang=\"en\" ng-app=\"ah\">\n" +
    "\n" +
    "<head>\n" +
    "  <meta charset=\"utf-8\">\n" +
    "  <meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">\n" +
    "  <title>actionhero.js</title>\n" +
    "  <link href='http://fonts.googleapis.com/css?family=Droid+Sans:400,700' rel='stylesheet' type='text/css'>\n" +
    "  <link rel=\"stylesheet\" href=\"app.css\"/>\n" +
    "  <link rel=\"stylesheet prefetch\" href=\"http://netdna.bootstrapcdn.com/font-awesome/4.0.3/css/font-awesome.css\">\n" +
    "</head>\n" +
    "\n" +
    "  <body>\n" +
    "\n" +
    "    <ui-view></ui-view>\n" +
    "\n" +
    "  <!-- App -->\n" +
    "  <script src=\"http://localhost:8080/public/javascript/actionheroClient.js\"></script>\n" +
    "  <script src=\"https://ajax.googleapis.com/ajax/libs/angularjs/1.3.14/angular.min.js\"></script>\n" +
    "  <script src=\"https://cdnjs.cloudflare.com/ajax/libs/angular-ui-router/0.2.15/angular-ui-router.js\"></script>\n" +
    "  <script src=\"app.js\"></script>\n" +
    "  <script src=\"templates.js\"></script>\n" +
    "</body>\n" +
    "\n" +
    "</html>\n"
  );


  $templateCache.put('views/app.html',
    "<div class=\"window-wrapper\">\n" +
    "\t<div class=\"window-area\">\n" +
    "\t\t<div class=\"conversation-list\">\n" +
    "\t\t\t<ul class=\"\">\n" +
    "\t\t\t\t<li class=\"item\"><a ui-sref=\"ah.intro\"><img src=\"http://www.actionherojs.com/img/logo/actionhero_400.png\" height=\"50px\" width=\"70px\"></a></li>\n" +
    "\t\t\t\t<li ui-sref-active=\"active\" class=\"item\"><a ui-sref=\"ah.server\"><i class=\"fa fa-list-alt\"></i><span>Server</span></a></li>\n" +
    "\t\t\t\t<li ui-sref-active=\"active\" class=\"item\"><a ui-sref=\"ah.chat\"><i class=\"fa  fa-comments-o\"></i><span>Chat</span></a></li>\n" +
    "\t\t\t\t<li ui-sref-active=\"active\" class=\"item\"><a ui-sref=\"ah.swagger\"><i class=\"fa fa-book\"></i><span>API Docs</span></a></li>\n" +
    "\t\t\t</ul>\n" +
    "\t\t</div>\n" +
    "\t\t<div class=\"chat-area\">\n" +
    "\t\t\t<div ui-view></div>\n" +
    "\t\t</div>\n" +
    "\t</div>\n" +
    "</div>"
  );


  $templateCache.put('views/chat.html',
    "<div class=\"title\">Real-Time Chat With Action Hero</div>\n" +
    "\n" +
    "<div class=\"chat-list bottom\">\n" +
    "  <ul>\n" +
    "    <ah-chat-message ng-repeat=\"message in ahClient.messages track by $index\" ng-if=\"message.from != '*me*'\"></ah-chat-message>\n" +
    "  </ul>\n" +
    "</div>\n" +
    "\n" +
    "<form class=\"input-area\" ng-submit=\"submitFunction()\">\n" +
    "  <div class=\"input-wrapper\">\n" +
    "    <input placeholder=\"Write a message..\" ng-model=\"writingMessage\" type=\"text\">\n" +
    "  </div>\n" +
    "  <input type=\"submit\" class=\"send-btn\"/>\n" +
    "</form>"
  );


  $templateCache.put('views/intro.html',
    "<div class=\"title\">Action Hero</div>\n" +
    "\n" +
    "<div class=\"chat-list intro background\">\n" +
    "  <h1 class=\"brand-heading\">actionhero</h1>\n" +
    "  <p class=\"intro-text\">The Reusable, Scalable, and Quick node.js API Server.</p>\n" +
    "  <a href=\"http://github.com/evantahler/actionhero\">\n" +
    "      <img src=\"/logo/actionhero.png\" width=\"300\" />\n" +
    "  </a>\n" +
    "  <h2>Congratulations!</h2> \n" +
    "  <h3>Your actionhero server is working.</h3>\n" +
    "\n" +
    "  <div class=\"about\">\n" +
    "    <h2>ABOUT ACTIONHERO</h2>\n" +
    "\n" +
    "    <p>actionhero.js is a multi-transport API Server with integrated cluster capabilities and delayed tasks.</p>\n" +
    "\n" +
    "    <p>actionhero was built from the ground up to include all the features you expect from a modern API framework. This includes all the features listed below and more. actionhero also knows when to get out of the way to allow you to customize your stack to fit your needs.</p>\n" +
    "\n" +
    "    <h2>TRY A REALTIME-CHAT WITH WEBSOCKETS</h2>\n" +
    "    <h2>LEARN MORE @ WWW.ACTIONHEROJS.COM/DOCS</h2>\n" +
    "  </div>\n" +
    "\n" +
    "</div>"
  );


  $templateCache.put('views/server.html',
    "<div class=\"title\">This Server</div>\n" +
    "\n" +
    "<div class=\"chat-list\">\n" +
    "  <div class=\"stats-table-container\">\n" +
    "    <h4 class=\"header\">Information</h4>\n" +
    "\n" +
    "    <ul class=\"stats-table\">\n" +
    "      <h4 class=\"subheader\">Server Name</h4>\n" +
    "      <li>\n" +
    "        <i ng-hide=\"data\" class=\"fa fa-spin fa-spinner\"></i>\n" +
    "        {{data ? data.serverInformation.serverName : 'Loading...'}}\n" +
    "      </li>\n" +
    "    </ul>\n" +
    "\n" +
    "    <ul class=\"stats-table\">\n" +
    "      <h4 class=\"subheader\">API Version</h4>\n" +
    "      <li>\n" +
    "        <i ng-hide=\"data\" class=\"fa fa-spin fa-spinner\"></i>\n" +
    "        {{data ? data.serverInformation.apiVersion : 'Loading...'}}\n" +
    "      </li>\n" +
    "    </ul>\n" +
    "\n" +
    "    <ul class=\"stats-table\">\n" +
    "      <h4 class=\"subheader\">Server Version</h4>\n" +
    "      <li>\n" +
    "        <i ng-hide=\"data\" class=\"fa fa-spin fa-spinner\"></i>\n" +
    "        {{data ? data.actionheroVersion : 'Loading...'}}\n" +
    "      </li>\n" +
    "    </ul>\n" +
    "\n" +
    "    <ul class=\"stats-table\">\n" +
    "      <h4 class=\"subheader\">Uptime</h4>\n" +
    "      <li>\n" +
    "        <i ng-hide=\"data\" class=\"fa fa-spin fa-spinner\"></i>\n" +
    "        {{data ? getMinutes(data.uptime) : 'Loading...'}}\n" +
    "      </li>\n" +
    "    </ul>\n" +
    "  </div>\n" +
    "\n" +
    "  <div class=\"stats-table-container\">\n" +
    "    <h4 class=\"header\">Stats</h4>\n" +
    "\n" +
    "    <ul ng-hide=\"data\" class=\"stats-table\">\n" +
    "      <li><i class=\"fa fa-spin fa-spinner\"></i> Loading...</li>\n" +
    "    </ul>\n" +
    "\n" +
    "    <ul ng-show=\"data\" class=\"stats-table\" ng-repeat=\"(id, values) in stats\">\n" +
    "      <h4 class=\"subheader\">{{id}}</h4>\n" +
    "      <li ng-repeat=\"(key, value) in values\">\n" +
    "        <ul><li class=\"pull-left\">{{key}}</li><li class=\"pull-right\">{{value}}</li></ul>\n" +
    "      </li>\n" +
    "    </ul>\n" +
    "\n" +
    "  </div>\n" +
    "</div>"
  );


  $templateCache.put('views/swagger.html',
    "<div class=\"title\">Api Documentation</div>\n" +
    "\n" +
    "<div class=\"chat-list\">\n" +
    "\t<div class=\"swagger-ui\">\n" +
    "\t  \n" +
    "\t  <ul class=\"list-unstyled endpoints\">\n" +
    "\t    <li ng-repeat=\"api in resources\" class=\"endpoint\">\n" +
    "\t      <ul class=\"list-unstyled operations\" ng-show=\"api.open\">\n" +
    "\t        <li ng-repeat=\"op in api.operations\" class=\"operation {{ op.httpMethod }}\">\n" +
    "\t          <swagger-heading></swagger-heading>\n" +
    "\t          <swagger-content></swagger-content>\n" +
    "\t        </li>\n" +
    "\t      </ul>\n" +
    "\t    </li>\n" +
    "\t  </ul>\n" +
    "\n" +
    "\t</div>\n" +
    "</div>\n"
  );


  $templateCache.put('views/swagger/content.html',
    " <div class=\"content\" ng-show=\"op.open\">\n" +
    "    <div ng-if=\"op.description\">\n" +
    "      <h5>implementation notes</h5>\n" +
    "      <p ng-bind=\"op.description\"></p>\n" +
    "    </div>\n" +
    "\n" +
    "\t<form role=\"form\" name=\"tryItForm\" ng-submit=\"tryItForm.$valid && submitTryIt(op)\">\n" +
    "\t  <div ng-if=\"op.responseClass\" class=\"response\">\n" +
    "\t    <h5>response class (status {{ op.responseClass.status }})</h5>\n" +
    "\t    \n" +
    "\t    <div ng-if=\"op.responseClass.display!==-1\">\n" +
    "\t      <ul class=\"list-inline schema\">\n" +
    "\t        <li><a ng-click=\"op.responseClass.display = 0\" ng-class=\"{ active : op.responseClass.display === 0 }\">model</a>\n" +
    "\t        </li>\n" +
    "\t        <li><a ng-click=\"op.responseClass.display = 1\" ng-class=\"{ active : op.responseClass.display === 1 }\">model schema</a>\n" +
    "\t        </li>\n" +
    "\t      </ul>\n" +
    "\t      <pre class=\"model\" ng-if=\"op.responseClass.display === 0\" ng-bind-html=\"op.responseClass.schema.model\"></pre>\n" +
    "\t      <pre class=\"model-schema\" ng-if=\"op.responseClass.display === 1\" ng-bind=\"op.responseClass.schema.json\"></pre>\n" +
    "\t    </div>\n" +
    "\n" +
    "\t    <div ng-if=\"op.produces\" class=\"content-type\">\n" +
    "\t      <label for=\"responseContentType{{ op.id }}\">response content type</label>\n" +
    "\t      <select ng-model=\"form[op.id].responseType\" ng-options=\"item for item in op.produces track by item\" id=\"responseContentType{{ op.id }}\" name=\"responseContentType{{ op.id }}\" required></select>\n" +
    "\t    </div>\n" +
    "\t  </div>\n" +
    "\n" +
    "\t  <div ng-if=\"op.parameters && op.parameters.length > 0\" class=\"table-responsive\">\n" +
    "\t    <h5>parameters</h5>\n" +
    "\t    <table class=\"table table-condensed parameters\">\n" +
    "\t      <thead>\n" +
    "\t        <tr>\n" +
    "\t          <th class=\"name\">parameter</th>\n" +
    "\t          <th class=\"value\">value</th>\n" +
    "\t          <th class=\"desc\">description</th>\n" +
    "\t          <th class=\"type\">parameter type</th>\n" +
    "\t          <th class=\"data\">data type</th>\n" +
    "\t        </tr>\n" +
    "\t      </thead>\n" +
    "\t      <tbody>\n" +
    "\t      \t<tr swagger-parameter ng-repeat=\"param in op.parameters\"></tr>\n" +
    "\t      </tbody>\n" +
    "\t    </table>\n" +
    "\t  </div>\n" +
    "\n" +
    "\t  <div class=\"table-responsive\" ng-if=\"op.hasResponses\">\n" +
    "\t    <h5>response messages</h5>\n" +
    "\t    <table class=\"table responses\">\n" +
    "\t      <thead>\n" +
    "\t        <tr>\n" +
    "\t          <th class=\"code\">HTTP status code</th>\n" +
    "\t          <th>reason</th>\n" +
    "\t          <th>response model</th>\n" +
    "\t        </tr>\n" +
    "\t      </thead>\n" +
    "\t      <tbody>\n" +
    "\t      \t<tr swagger-response ng-repeat=\"(code, resp) in op.responses\" code=\"code\" resp=\"resp\"></tr>\n" +
    "\t      </tbody>\n" +
    "\t    </table>\n" +
    "\t  </div>\n" +
    "\n" +
    "\t  <div>\n" +
    "\t    <button class=\"btn btn-default\" ng-click=\"op.tryItResult = false; op.hideTryItResult = false\" type=\"submit\" ng-disabled=\"op.loading\" ng-bind=\"op.loading ? 'loading...' : 'try it out!'\"></button>\n" +
    "\t    <a class=\"hide-try-it\" ng-if=\"op.tryItResult && !op.hideTryItResult\" ng-click=\"op.hideTryItResult = true\">hide response</a>\n" +
    "\t  </div>\n" +
    "\t  \n" +
    "\t</form>\n" +
    "\n" +
    "    <div ng-if=\"op.tryItResult\" ng-show=\"!op.hideTryItResult\">\n" +
    "      <h5>request URL</h5>\n" +
    "      <pre ng-bind=\"op.tryItResult.url\"></pre>\n" +
    "      <h5>response body</h5>\n" +
    "      <pre ng-bind=\"op.tryItResult.response.body\"></pre>\n" +
    "      <h5>response code</h5>\n" +
    "      <pre ng-bind=\"op.tryItResult.response.status\"></pre>\n" +
    "      <h5>response headers</h5>\n" +
    "      <pre ng-bind=\"op.tryItResult.response.headers\"></pre>\n" +
    "    </div>\n" +
    " </div>"
  );


  $templateCache.put('views/swagger/heading.html',
    "<div class=\"heading\">\n" +
    "    <a ng-click=\"op.open = !op.open\">\n" +
    "      <div class=\"clearfix\">\n" +
    "        <span class=\"http-method text-uppercase\" ng-bind=\"op.httpMethod\"></span>\n" +
    "        <span class=\"path\" ng-bind=\"op.path\"></span>\n" +
    "        <span class=\"description pull-right\" ng-bind=\"op.summary\"></span>\n" +
    "      </div>\n" +
    "    </a>\n" +
    "</div>\n"
  );


  $templateCache.put('views/swagger/parameter.html',
    "<td ng-class=\"{ bold : param.required }\">\n" +
    "  <label for=\"param{{ param.id }}\" ng-bind=\"param.name\"></label>\n" +
    "</td>\n" +
    "<td ng-class=\"{ bold : param.required }\">\n" +
    "  <div>\n" +
    "    <div ng-if=\"param.in !== 'body'\">\n" +
    "      <input type=\"text\" ng-model=\"form[op.id][param.name]\" id=\"param{{ param.id }}\" placeholder=\"{{ param.required ? '(required)' : ''}}\" ng-required=\"param.required\">\n" +
    "    </div>\n" +
    "    <div ng-if=\"param.in === 'body'\">\n" +
    "      <textarea id=\"param{{ param.id }}\" ng-model=\"form[op.id][param.name]\" ng-required=\"param.required\"></textarea>\n" +
    "      <br>\n" +
    "      <div ng-if=\"op.consumes\" class=\"content-type\">\n" +
    "        <label for=\"bodyContentType{{ op.id }}\">parameter content type</label>\n" +
    "        <select ng-model=\"form[op.id].contentType\" id=\"bodyContentType{{ op.id }}\" name=\"bodyContentType{{ op.id }}\" ng-options=\"item for item in op.consumes track by item\"></select>\n" +
    "      </div>\n" +
    "    </div>\n" +
    "  </div>\n" +
    "</td>\n" +
    "<td ng-class=\"{ bold : param.required }\" ng-bind=\"param.description\"></td>\n" +
    "<td ng-bind=\"param.in\"></td>\n" +
    "<td ng-if=\"param.type && !param.schema\">\n" +
    "  <span ng-bind=\"param.type\"></span>\n" +
    "</td>\n" +
    "<td ng-if=\"param.schema\">\n" +
    "  <ul class=\"list-inline schema\">\n" +
    "    <li><a ng-click=\"param.schema.display=0\" ng-class=\"{ active : param.schema.display === 0 }\">model</a>\n" +
    "    </li>\n" +
    "    <li><a ng-click=\"param.schema.display=1\" ng-class=\"{ active : param.schema.display === 1 }\">model schema</a>\n" +
    "    </li>\n" +
    "  </ul>\n" +
    "  <pre class=\"model\" ng-if=\"param.schema.display === 0 && param.schema.model\" ng-bind-html=\"param.schema.model\"></pre>\n" +
    "  <div class=\"model-schema\" ng-if=\"param.schema.display === 1 && param.schema.json\">\n" +
    "    <pre ng-bind=\"param.schema.json\" ng-click=\"form[op.id][param.name]=param.schema.json\" aria-described-by=\"help-{{ param.id }}\"></pre>\n" +
    "    <div id=\"help-{{ param.id }}\">click to set as parameter value</div>\n" +
    "  </div>\n" +
    "</td>"
  );


  $templateCache.put('views/swagger/response.html',
    "<td ng-bind=\"code\"></td>\n" +
    "<td ng-bind-html=\"resp.description\"></td>\n" +
    "<td>\n" +
    "  <ul ng-if=\"resp.schema && resp.schema.model && resp.schema.json\" class=\"list-inline schema\">\n" +
    "    <li><a ng-click=\"resp.display=0\" ng-class=\"{ active : resp.display === 0 }\">model</a>\n" +
    "    </li>\n" +
    "    <li><a ng-click=\"resp.display=1\" ng-class=\"{ active : resp.display === 1 }\">model schema</a>\n" +
    "    </li>\n" +
    "  </ul>\n" +
    "  <pre class=\"model\" ng-if=\"resp.display === 0 && resp.schema && resp.schema.model\" ng-bind-html=\"resp.schema.model\"></pre>\n" +
    "  <pre class=\"model-schema\" ng-if=\"resp.display === 1 && resp.schema && resp.schema.json\" ng-bind=\"resp.schema.json\"></pre>\n" +
    "</td>"
  );

}]);
