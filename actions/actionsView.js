var action = {};

/////////////////////////////////////////////////////////////////////
// metadata
action.name = "actionsView";
action.description = "I will return an array of all the action accessable to uses of this API";
action.inputs = {
  "required" : [],
  "optional" : []
};
action.outputExample = {
  "actions" : [
  {
    "name" : "actionName",
    "description" : "something about the action",
    "inputs" : {
      "required" : ["input 1", "input 2"],
      "optional" : ["input 3", "input 4"]
    },
    "outputExample" : {
      "listOfStuff" : [1,2,3]
    }
  }
  ]
}

/////////////////////////////////////////////////////////////////////
// functional
action.run = function(api, connection, next){
  connection.response.actions = [];
  for(var i in api.actions){
    connection.response.actions.push({
      name: api.actions[i].name,
      description: api.actions[i].description,
      inputs: api.actions[i].inputs,
      outputExample: api.actions[i].outputExample,
    });
  }
  connection.response.actions.sort(function compare(a,b) {
    if (a.name < b.name)
       return -1;
    if (a.name > b.name)
      return 1;
    return 0;
  });
  
  next(connection, true);
};

/////////////////////////////////////////////////////////////////////
// exports
exports.action = action;