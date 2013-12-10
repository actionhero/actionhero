var fs = require('fs');

var params = function(api, next){

  api.params = {};

  // special params we will always accept
  api.params.globalSafeParams = [
    'file',
    'apiVersion',
    'callback',
    'action',
    'limit',
    'offset',
    'roomMatchKey',
    'roomMatchValue'
  ];

  api.params.buildPostVariables = function(){
    var postVariables = [];
    api.params.globalSafeParams.forEach(function(p){
      postVariables.push(p);
    });
    var i, j, k;
    for(i in api.actions.actions){
      for(j in api.actions.actions[i]){
        var action = api.actions.actions[i][j];
        if(action.inputs.required.length > 0){
          for(k in action.inputs.required){
            postVariables.push(action.inputs.required[k]);
          }
        }
        if(action.inputs.optional.length > 0){
          for(k in action.inputs.optional){
            postVariables.push(action.inputs.optional[k]);
          }
        }
      }
    }
    api.params.postVariables = api.utils.arrayUniqueify(postVariables);
    return api.params.postVariables;
  }
  
  ////////////////////////////////////////////////////////////////////////////
  // api param checking
  api.params.requiredParamChecker = function(connection, required_params, mode){
    if(null === mode){ mode = 'all' }
    if(mode == 'all'){
      required_params.forEach(function(param){
        if(null === connection.error && ('undefined' === typeof connection.params[param] || 0 === connection.params[param].length)){
          connection.error = new Error(param + ' is a required parameter for this action');
        }
      });
    }
    if('any' === mode){
      var paramString = '';
      var found = false;
      required_params.forEach(function(param){
        if('' !== paramString){ paramString = paramString + ',' }
        paramString = paramString + ' ' + param;
        if(null !== connection.params[param]){
          found = true;
        }
      });
      if(false === found){
        connection.error = new Error(
          'none of the required params for this action were provided.  ' +
          'Any of the following are required: ' + paramString
        );
      }
    }
  }

  api.params.buildPostVariables();
  next();
}

/////////////////////////////////////////////////////////////////////
// exports
exports.params = params;