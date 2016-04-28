'use strict';

module.exports = {
  loadPriority:  420,
  initialize: function(api, next){

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
      var i;
      var j;

      api.params.globalSafeParams.forEach(function(p){
        postVariables.push(p);
      });

      for(i in api.actions.actions){
        for(j in api.actions.actions[i]){
          var action = api.actions.actions[i][j];
          for(var key in action.inputs){
            postVariables.push(key);
          }
        }
      }

      api.params.postVariables = api.utils.arrayUniqueify(postVariables);
      return api.params.postVariables;
    };

    api.params.buildPostVariables();
    next();
  }
};
