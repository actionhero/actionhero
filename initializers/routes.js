var fs = require('fs');

var routes = function(api, next){

  api.routes = {};
  api.routes.routes = {};

  ////////////////////////////////////////////////////////////////////////////
  // route processing for web clients
  api.routes.processRoute = function(connection){
    if(connection.params["action"] == null || ( api.actions.actions[connection.params["action"]] === undefined && connection.actionSetBy != "queryParam")){
      var method = connection.method.toLowerCase();
      var pathParts = connection.parsedURL.pathname.split("/");
      for(var i in api.routes.routes){
        var routePrefix = i;
        if (pathParts[1] == routePrefix){
          for(var j in api.routes.routes[i]){
            var routeMethod = j;
            var route = api.routes.routes[i][j];
            if(routeMethod == method){
              connection.params["action"] = route.action;
              connection.actionSetBy = "routes";
              var routeParams = api.params.mapParamsFromURL(connection, route.urlMap, routePrefix);
              for(var k in routeParams){
                if(connection.params[k] == null){
                  connection.params[k] = routeParams[k];
                }
              }
              break;
            }
          }
          break;
        }
      }
    }
  }

  // load in the routes file
  var loadRoutes = function(){
    var routesFile = process.cwd() + '/routes.js';
    if(fs.existsSync(routesFile)){
      delete require.cache[routesFile];
      api.routes.routes = require(routesFile).routes;
      for(var i in api.routes){
        for(var j in api.routes.routes[i]){
          var tmp = api.routes.routes[i][j];
          delete api.routes[i][j];
          api.routes.routes[i][j.toLowerCase()] = tmp;
        }
      }
      api.log(api.utils.hashLength(api.routes.routes) + " routes loaded from " + routesFile, "debug");
    }else{
      api.log("no routes file found, skipping", "debug");
    }
  };

  if(api.configData.general.developmentMode == true){
    var routesFile = process.cwd() + '/routes.js';
    fs.watchFile(routesFile, {interval:1000}, function(curr, prev){
      if(curr.mtime > prev.mtime){
        process.nextTick(function(){
          if(fs.readFileSync(routesFile).length > 0){
            loadRoutes();
          }
        });
      }
    });
  };

  loadRoutes();

  next();
}

/////////////////////////////////////////////////////////////////////
// exports
exports.routes = routes;