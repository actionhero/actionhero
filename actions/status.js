exports.action = {
  name: 'status',
  description: 'I will return some basic information about the API',
  inputs: {
    'required': [],
    'optional': []
  },
  blockedConnectionTypes: [],
  outputExample: {
    status: 'OK',
    uptime: 1234,
    stats: {}
  },
  run: function(api, connection, next){
    connection.response.id = api.id;
    connection.response.actionheroVersion = api.actionheroVersion;
    var now = new Date().getTime();
    connection.response.uptime = now - api.bootTime;
    api.stats.getAll(function(err, stats){
      connection.response.stats = stats;
      api.tasks.details(function(err, details){
        connection.response.queues = details.queues;
        connection.response.workers = details.workers;
        next(connection, true);
      });
    });
  }
};
