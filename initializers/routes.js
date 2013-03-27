var fs = require('fs');

var routes = function(api, next){

  api.routes = {};
  api.routes.routes = {};

  ////////////////////////////////////////////////////////////////////////////
  // route processing for web clients
  api.routes.processRoute = function(connection){
    if(connection.params["action"] == null || ( api.actions.actions[connection.params["action"]] === undefined && connection.actionSetBy != "queryParam")){
      var method = connection.method.toLowerCase();
      for(var i in api.routes.routes[method]){
        var route = api.routes.routes[method][i];
        var match = api.routes.matchURL(connection.parsedURL.pathname, route.path);
        if(match.match === true){
          for(var param in match.params){
            connection.params[param] = match.params[param];
          }
          connection.params["action"] = route.action;
          connection.actionSetBy = "routes";
          break;
        }
      } 
    }
  }

  api.routes.matchURL = function(url, match){
    var response = {match: false, params: {} }
    var urlParts = url.split("/");
    var matchParts = match.split("/");
    var regexp = "";
    if(urlParts[0] == ""){ urlParts.splice(0,1); }
    if(matchParts[0] == ""){ matchParts.splice(0,1); }
    if(urlParts[(urlParts.length - 1)] == ""){ urlParts.pop(); }
    if(matchParts[(matchParts.length - 1)] == ""){ matchParts.pop(); }
    if(urlParts[0] == api.configData.commonWeb.urlPathForActions){ urlParts.splice(0,1); }
    for(var i in matchParts){
      var part = matchParts[i];
      if(part[0] === ":"){
        var variable = part.replace(":","");
        response.params[variable] = urlParts[i];
      }else{
        if(urlParts[i] != matchParts[i]){
          return response;
        }
      }
    }
    response.match = true;
    return response;
  }

  // load in the routes file
  api.routes.loadRoutes = function(){
    var counter = 0;
    var routesFile = process.cwd() + '/routes.js';
    if(fs.existsSync(routesFile)){
      api.routes.routes = { "get": [], "post": [], "put": [], "delete": [] };
      delete require.cache[routesFile];
      var rawRoutes = require(routesFile).routes;
      for(var i in rawRoutes){
        var method = i.toLowerCase(); 
        for(var j in rawRoutes[i]){
          var route = rawRoutes[i][j];
          if(method == "all"){
            ["get", "post", "put", "delete"].forEach(function(verb){
              api.routes.routes[verb].push({ path: route.path.toLowerCase(), action: route.action });
            });
          }else{
            api.routes.routes[method].push({ path: route.path.toLowerCase(), action: route.action });
          }
          counter++;
        }
      }
      api.log(counter + " routes loaded from " + routesFile, "debug", api.routes.routes);
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

  api.routes.loadRoutes();
  next();
}

/////////////////////////////////////////////////////////////////////
// exports
exports.routes = routes;