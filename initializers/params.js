var fs = require('fs');

var params = function(api, next){
  
  api.params = {};

  // special params we will always accept
  api.params.buildPostVariables = function(){
    var postVariables = [
      "callback",
      "action",
      "limit",
      "offset",
      "outputType",
      "fileName",
      "roomMatchKey",
      "roomMatchValue"
    ];
    for(var i in api.actions.actions){
      var action = api.actions.actions[i];
      if(action.inputs.required.length > 0){
        for(var j in action.inputs.required){
          postVariables.push(action.inputs.required[j]);
        }
      }
      if(action.inputs.optional.length > 0){
        for(var j in action.inputs.optional){
          postVariables.push(action.inputs.optional[j]);
        }
      }
    }
    api.params.postVariables = api.utils.arrayUniqueify(postVariables);
    return api.params.postVariables;
  }

  ////////////////////////////////////////////////////////////////////////////
  // parse a connections's URL and build params based on RESTful map
  // map is an array of the param's keys in order (ie: /:action/:userID/:email/:gameID => ['userID', 'email', 'gameID'])
  // the action itself will be ommited from consideration in the mapping
  // these are equvilent: [ localhost:8080/a/path/and/stuff?action=randomNumber ] && [ localhost:8080/randomNumber/a/path/and/stuff ]
  api.params.mapParamsFromURL = function(connection, map, routePrefix){
    if(connection.parsedURL != null && connection.parsedURL.path != null){
      if(map == null){ map = []; };
      var urlParts = connection.parsedURL.path.split("/");
      var urlParams = {};
      var mapCounter = 0;
      if(connection.params != null){
        var actionParam = connection.params.action;
      }else{
        var actionParam = null;
      }
      for (var i in urlParts){
        var part = urlParts[i].split("?")[0];
        if(part != "" && part != connection.action && part != actionParam && map[mapCounter] != null){
          if(routePrefix != null){
            if(part != routePrefix){
              urlParams[map[mapCounter]] = part;
              mapCounter++;
            }
          }else{
            urlParams[map[mapCounter]] = part;
            mapCounter++;
          }
        }
      }
      return urlParams;
    }else{
      return null;
    }
  }
  
  ////////////////////////////////////////////////////////////////////////////
  // api param checking
  api.params.requiredParamChecker = function(connection, required_params, mode){
    if(mode == null){mode = "all";}
    if(mode == "all"){
      required_params.forEach(function(param){
        if(connection.error === null && (connection.params[param] === undefined || connection.params[param].length == 0)){
          connection.error = new Error(param + " is a required parameter for this action");
          if(api.configData.commonWeb.returnErrorCodes == true && connection.type == "web"){
            connection.responseHttpCode = 422;
          }
        }
      });
    }
    if(mode == "any"){
      var paramString = "";
      var found = false;
      required_params.forEach(function(param){
        if(paramString != ""){paramString = paramString + ",";}
        paramString = paramString + " " + param;
        if(connection.params[param] != null){
          found = true;
        }
      });
      if(found == false)
      {
        connection.error = new Error("none of the required params for this action were provided.  Any of the following are required: " + paramString);
        if(api.configData.commonWeb.returnErrorCodes == true && connection.type == "web"){
          connection.responseHttpCode = 422;
        }
      }
    }
  }

  api.params.buildPostVariables();
  next();
}

/////////////////////////////////////////////////////////////////////
// exports
exports.params = params;