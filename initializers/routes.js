var fs = require('fs');

var routes = function(api, next){

  api.routes = {};
  api.routes.routes = {};
  api.routes.routesFile = api.project_root + '/routes.js';

  ////////////////////////////////////////////////////////////////////////////
  // route processing for web clients
  api.routes.processRoute = function(connection){
    if(connection.params['action'] == null || typeof api.actions.actions[connection.params['action']] === 'undefined'){
      var method = connection.rawConnection.method.toLowerCase();
      for(var i in api.routes.routes[method]){
        var route = api.routes.routes[method][i];
        var match = api.routes.matchURL(connection.rawConnection.parsedURL.pathname, route.path);
        if(match.match === true){
          for(var param in match.params){
            var decodedName = decodeURIComponent(param.replace(/\+/g, ' '));
            var decodedValue = decodeURIComponent(match.params[param].replace(/\+/g, ' '));
            connection.params[decodedName] = decodedValue;
          }
          connection.params['action'] = route.action;
          break;
        }
      }
    }
  }

  api.routes.matchURL = function(url, match){
    var response = {match: false, params: {} }
    var urlParts = url.split('/');
    var matchParts = match.split('/');
    var regexp = '';
    var variable = '';
    if(urlParts[0] == ''){ urlParts.splice(0, 1) }
    if(matchParts[0] == ''){ matchParts.splice(0, 1) }
    if(urlParts[(urlParts.length - 1)] == ''){ urlParts.pop() }
    if(matchParts[(matchParts.length - 1)] == ''){ matchParts.pop() }
    if(urlParts[0] == api.config.servers.web.urlPathForActions){ urlParts.splice(0, 1) }
    for(var i in matchParts){
      var part = matchParts[i];
      if(!urlParts[i]){
        return response;
      } else if(part[0] === ':' && part.indexOf('(') < 0){
        variable = part.replace(':', '');
        response.params[variable] = urlParts[i];
      } else if(part[0] === ':' && part.indexOf('(') >= 0){
        variable = part.replace(':', '').split('(')[0];
        regexp = part.split('(')[1];
        var matches = urlParts[i].match(new RegExp(regexp.substring(0, regexp.length - 1), 'g'));
        if(matches != null){
          response.params[variable] = urlParts[i];
        } else {
          return response;
        }
      } else {
        if(urlParts[i] == null || urlParts[i].toLowerCase() != matchParts[i].toLowerCase()){
          return response;
        }
      }
    }
    response.match = true;
    return response;
  }

  // load in the routes file
  api.routes.loadRoutes = function(rawRoutes){
    var counter = 0;
    api.routes.routes = { 'get': [], 'post': [], 'put': [], 'patch' : [], 'delete': [] };

    if(rawRoutes == null){
      if(fs.existsSync(api.routes.routesFile)){
        delete require.cache[require.resolve(api.routes.routesFile)];
        rawRoutes = require(api.routes.routesFile).routes;
      } else {
        api.log('no routes file found, skipping', 'debug');
        return;
      }
    }
    for(var i in rawRoutes){
      var method = i.toLowerCase();
      for(var j in rawRoutes[i]){
        var route = rawRoutes[i][j];
        if(method == 'all'){
          ['get', 'post', 'put', 'patch', 'delete'].forEach(function(verb){
            api.routes.routes[verb].push({ path: route.path, action: route.action });
          });
        } else {
          api.routes.routes[method].push({ path: route.path, action: route.action });
        }
        var words = route.path.split('/');
        words.forEach(function(word){
          if(word[0] === ':'){
            var cleanedWord = word.replace(':', '');
            api.params.postVariables.push(cleanedWord);
          }
        });
        counter++;
      }
    }
    api.params.postVariables = api.utils.arrayUniqueify(api.params.postVariables)
    api.log(counter + ' routes loaded from ' + api.routes.routesFile, 'debug', api.routes.routes);
  };

  api.watchFileAndAct(api.routes.routesFile, function(){
    api.routes.loadRoutes();
  });

  api.routes.loadRoutes();
  next();
}

/////////////////////////////////////////////////////////////////////
// exports
exports.routes = routes;
