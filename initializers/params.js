var fs = require('fs');

var params = function(api, next){
  
  api.params = {};

  // special params we will always accept
  api.params.buildPostVariables = function(){
    var postVariables = [
      "file",
      "callback",
      "action",
      "limit",
      "offset",
      "outputType",
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
  // api param checking
  api.params.requiredParamChecker = function(connection, required_params, mode){
    if(mode == null){mode = "all";}
    if(mode == "all"){
      required_params.forEach(function(param){
        if(connection.error === null && (connection.params[param] === undefined || connection.params[param].length == 0)){
          connection.error = new Error(param + " is a required parameter for this action");
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
      }
    }
  }

  api.params.buildPostVariables();
  next();
}

/////////////////////////////////////////////////////////////////////
// exports
exports.params = params;