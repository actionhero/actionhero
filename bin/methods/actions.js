exports.actions = function(binary, next){
  var ActionheroPrototype = require(binary.paths.actionheroRoot + '/actionhero.js').actionheroPrototype;
  var actionhero = new ActionheroPrototype();
  var configChanges = { logger: {transports: null} };

  actionhero.initialize({configChanges: configChanges}, function(err, api){
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

    process.exit();
  });
};
