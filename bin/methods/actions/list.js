'use strict';

module.exports = function(api, next){
  for(var actionName in api.actions.actions){

    api.log(actionName);
    var collection = api.actions.actions[actionName];

    for(var version in collection){
      var action = collection[version];
      api.log('  ' + 'version: ' + version);
      api.log('    ' + action.description);
      api.log('    inputs: ');
      for(var input in action.inputs){
        api.log('      ' + input + ': ' + JSON.stringify(action.inputs[input]));
      }
    }
  }

  next(null, true);
};
