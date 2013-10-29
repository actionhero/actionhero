var fs = require('fs');

var routes = function(api, next){

  api.routes = {};
  api.routes.routes = {};

  ////////////////////////////////////////////////////////////////////////////
  // route processing for web clients
  api.routes.processRoute = function(connection){
    if(connection.params["action"] == null || ( api.actions.actions[connection.params["action"]] === undefined)){
      var method = connection.rawConnection.method.toLowerCase();
      for(var i in api.routes.routes[method]){
        var route = api.routes.routes[method][i];
        var match = api.routes.matchURL(connection.rawConnection.parsedURL.pathname, route.path);
        if(match.match === true){
          for(var param in match.params){
            connection.params[param] = match.params[param];
          }
          connection.params["action"] = route.action;
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
    if(urlParts[0] == api.configData.servers.web.urlPathForActions){ urlParts.splice(0,1); }
    for(var i in matchParts){
      var part = matchParts[i];
      if (!urlParts[i]) {
        return response;
      }else if(part[0] === ":" && part.indexOf("(") < 0){
        var variable = part.replace(":","");
        response.params[variable] = urlParts[i];
      }else if(part[0] === ":" && part.indexOf("(") >= 0){
        var variable = part.replace(":","").split("(")[0];
        var regexp = part.split("(")[1];  
        regexp = new RegExp(regexp.substring(0, regexp.length - 1), 'g');
        var matches = urlParts[i].match(regexp);
        if(matches != null){
          response.params[variable] = urlParts[i];
        }else{
          return response;
        }
      }else{
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
    api.routes.routes = { "get": [], "post": [], "put": [], "delete": [] };
    
    if(rawRoutes == null){
      var routesFile = api.project_root + '/routes.js';
      if(fs.existsSync(routesFile)){
        delete require.cache[require.resolve(routesFile)];
        var rawRoutes = require(routesFile).routes;
      }else{
        api.log("no routes file found, skipping", "debug");
        return;
      }
    }
    for(var i in rawRoutes){
      var method = i.toLowerCase(); 
      for(var j in rawRoutes[i]){
        var route = rawRoutes[i][j];
        if(method == "all"){
          ["get", "post", "put", "delete"].forEach(function(verb){
            api.routes.routes[verb].push({ path: route.path, action: route.action });
          });
        }else{
          api.routes.routes[method].push({ path: route.path, action: route.action });
        }
        var words = route.path.split("/");
        words.forEach(function(word){
          if(word[0] === ":"){
            var cleanedWord = word.replace(":","");
            api.params.postVariables.push(cleanedWord);
          }
        });
        counter++;
      }
    }
    api.params.postVariables = api.utils.arrayUniqueify(api.params.postVariables)
    api.log(counter + " routes loaded from " + routesFile, "debug", api.routes.routes);
  };

  if(api.configData.general.developmentMode == true){
    var routesFile = api.project_root + '/routes.js';
    fs.watchFile(routesFile, {interval:1000}, function(curr, prev){
      if(curr.mtime > prev.mtime){
        process.nextTick(function(){
          if(fs.readFileSync(routesFile).length > 0){
            api.routes.loadRoutes();
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