var task = {};

/////////////////////////////////////////////////////////////////////
// metadata
task.name = "runAction";
task.description = "I will run an action and return the connection object";
task.scope = "any";
task.frequency = 0;

/////////////////////////////////////////////////////////////////////
// functional 

task.run = function(api, params, next){
  if(params == null){params = {};}

  var connection = new api.connection({
    type: 'task', 
    remotePort: '0', 
    remoteIP: '0', 
    rawConnection: {},
  });
  connection.params = params;

  var actionProcessor = new api.actionProcessor({connection: connection, callback: function(connection, cont){
    if(connection.error){
      api.log("task error: "+connection.error, "red");
    }else{
      if(api.configData.log.logRequests){
        api.logJSON({
          label: "action @ task",
          params: JSON.stringify(params),
        }, "grey");
      }
    }
    next(connection, true);
  }});
  actionProcessor.processAction();
};

/////////////////////////////////////////////////////////////////////
// exports
exports.task = task;
