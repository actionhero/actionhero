var action = {};

/////////////////////////////////////////////////////////////////////
// metadata
action.name = 'status';
action.description = 'I will return some basic information about the API';
action.inputs = {
  'required' : [],
  'optional' : []
};
action.blockedConnectionTypes = [];
action.outputExample = {
  status: 'OK',
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
    api.tasks.details(function(err, details){
      connection.response.queues = details['queues'];
      next(connection, true);
    });
  });
};

/////////////////////////////////////////////////////////////////////
// exports
exports.action = action;
