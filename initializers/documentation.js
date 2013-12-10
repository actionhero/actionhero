var documentation = function(api, next){

  api.documentation = {
    documentation: {},
    build: function(){
      for(var i in api.actions.actions){
        for(var j in api.actions.actions[i]){
          var action = api.actions.actions[i][j];
          if(action.toDocument !== false){
            if(api.documentation.documentation[action.name] == null){ api.documentation.documentation[action.name] = {} }
            api.documentation.documentation[action.name][action.version] = {
              name: action.name,
              version: action.version,
              description: action.description,
              inputs: action.inputs,
              outputExample: action.outputExample
            };
          }
        }
      }
    }
  };
  
  api.documentation.build();
  next();
}

/////////////////////////////////////////////////////////////////////
// exports
exports.documentation = documentation;
