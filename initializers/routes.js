var fs = require('fs');

var routes = function(api, next){

  api.routes = {};
  api.routes.routes = {};
  api.routes.routesFile = api.projectRoot + '/routes.js'; //deprecated, see github issue #450

  ////////////////////////////////////////////////////////////////////////////
  // route processing for web clients
  api.routes.processRoute = function(connection, pathParts){
    if(connection.params['action'] == null || typeof api.actions.actions[connection.params['action']] === 'undefined'){
      var method = connection.rawConnection.method.toLowerCase();
      if(method == 'head'){ method = 'get'; }
      for(var i in api.routes.routes[method]){
        var route = api.routes.routes[method][i];
        var match = api.routes.matchURL(pathParts, route.path);
        if(match.match === true){
          for(var param in match.params){
            try{
              var decodedName = decodeURIComponent(param.replace(/\+/g, ' '));
              var decodedValue = decodeURIComponent(match.params[param].replace(/\+/g, ' '));
              connection.params[decodedName] = decodedValue;
            }catch(e){
              // malformed URL
            }
          }
          connection.params['action'] = route.action;
          break;
        }
      }
    }
  }

  api.routes.matchURL = function(pathParts, match){
    var response = {match: false, params: {} }
    var matchParts = match.split('/');
    var regexp = '';
    var variable = '';
    
    if(matchParts[0] == ''){ matchParts.splice(0, 1) }
    if(matchParts[(matchParts.length - 1)] == ''){ matchParts.pop() }
    
    if(matchParts.length != pathParts.length){
      return response;
    }

    for(var i in matchParts){
      var part = matchParts[i];
      if(!pathParts[i]){
        return response;
      } else if(part[0] === ':' && part.indexOf('(') < 0){
        variable = part.replace(':', '');
        response.params[variable] = pathParts[i];
      } else if(part[0] === ':' && part.indexOf('(') >= 0){
        variable = part.replace(':', '').split('(')[0];
        regexp = part.split('(')[1];
        var matches = pathParts[i].match(new RegExp(regexp.substring(0, regexp.length - 1), 'g'));
        if(matches != null){
          response.params[variable] = pathParts[i];
        } else {
          return response;
        }
      } else {
        if(pathParts[i] == null || pathParts[i].toLowerCase() != matchParts[i].toLowerCase()){
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
      //depricated, see github issue #450
      if(fs.existsSync(api.routes.routesFile)){
        api.log('Using the routes.js in your project root is depricated.', 'warning')
        delete require.cache[require.resolve(api.routes.routesFile)];
        rawRoutes = require(api.routes.routesFile).routes;
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
    api.log(counter + ' routes loaded from ' + api.routes.routesFile, 'debug');

    if(api.config.servers.web != null && api.config.servers.web.simpleRouting === true){
      var simplePaths = [];
      for(var action in api.actions.actions){
        simplePaths.push('/' + action);
        ['get', 'post', 'put', 'patch', 'delete'].forEach(function(verb){
          api.routes.routes[verb].push({ path: '/' + action, action: action });
        });
      }
      api.log(simplePaths.length + ' simple routes loaded from action names', 'debug');

      api.log('routes:', 'debug', api.routes.routes);
    }
  };

  //depricated, see github issue #450
  if(fs.existsSync(api.routes.routesFile)){
    api.routes.loadRoutes();
    api.watchFileAndAct(api.routes.routesFile, function(){
      api.routes.loadRoutes();
    });
  }else{
    api.routes.loadRoutes(api.config.routes);
  }  
  
  next();
}

/////////////////////////////////////////////////////////////////////
// exports
exports.routes = routes;
