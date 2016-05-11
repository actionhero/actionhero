'use strict';

exports.actions = function(binary, next){
  var actionheroPrototype = require(binary.actionheroRoot + '/actionhero.js').actionheroPrototype;
  var actionhero = new actionheroPrototype();
  var configChanges = {logger: {transports: null}};

  actionhero.initialize({configChanges: configChanges}, function(error, api){
    for(var actionName in api.actions.actions){

      binary.log(actionName);
      var collection = api.actions.actions[actionName];

      for(var version in collection){
        var action = collection[version];
        binary.log('  ' + 'version: ' + version);
        binary.log('    ' + action.description);
        binary.log('    inputs: ');
        for(var input in action.inputs){
          binary.log('      ' + input + ': ' + JSON.stringify(action.inputs[input]));
        }
      }
    }

    next(true);
  });
};
