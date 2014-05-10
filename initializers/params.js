var fs = require('fs');

var params = function(api, next){

  api.params = {};

  // special params we will always accept
  api.params.globalSafeParams = [
    'file',
    'apiVersion',
    'callback',
    'action',
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

  api.params.buildPostVariables();
  next();
}

/////////////////////////////////////////////////////////////////////
// exports
exports.params = params;