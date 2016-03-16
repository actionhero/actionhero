var task = {
  name:          'runAction',
  description:   'I will run an action and return the connection object',
  queue:         'default',
  plugins:       [],
  pluginOptions: [],
  frequency:     0,
  run: function(api, params, next){
    if(!params){ params = {}; }

    var connection = new api.connection({
      type: 'task',
      remotePort: '0',
      remoteIP: '0',
      rawConnection: {}
    });

    connection.params = params;

    var actionProcessor = new api.actionProcessor(connection, function(data){
      if(data.response.error){
        api.log('task error: ' + data.response.error, 'error', {params: JSON.stringify(params)});
      }else{
        api.log('[ action @ task ]', 'debug', {params: JSON.stringify(params)});
      }

      connection.destroy(function(){
        next(data.response.error, data.response);
      });
    });

    actionProcessor.processAction();
  }
};

exports.task = task;
