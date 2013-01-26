var action = {};

/////////////////////////////////////////////////////////////////////
// metadata
action.name = "status";
action.description = "I will return some basic information about the API";
action.inputs = {
  "required" : [],
  "optional" : []
};
action.blockedConnectionTypes = [];
action.outputExample = {
  status: "OK",
  uptime: 1234,
  stats: {}
}

/////////////////////////////////////////////////////////////////////
// functional
action.run = function(api, connection, next){
  connection.response.id = api.id;
  var now = new Date().getTime();
  connection.response.uptime = now - api.bootTime;
  api.stats.getAll(function(err, stats){
    connection.response.stats = stats;
    connection.response.tasks = {};
    connection.response.workers = {};
    api.tasks.getAllTasks(api, function(err, allTasks){
      for(var i in allTasks){
        connection.response.tasks[i] = allTasks[i];
      }
      api.tasks.getWorkerStatuses(function(err, workerStatuses){
        for(var i in workerStatuses){
          connection.response.workers[i] = workerStatuses[i];
        }
        next(connection, true);
      });
    });
  });
};

/////////////////////////////////////////////////////////////////////
// exports
exports.action = action;