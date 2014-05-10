var os = require('os');

var exceptions = function(api, next){

  api.exceptionHandlers = {};
  api.exceptionHandlers.reporters = [];

  var consoleReporter = function(type, err, extraMessages, severity){
    for(var i in extraMessages){
      var line = extraMessages[i];
      api.log(line, severity);
    }
    var lines = err.stack.split(os.EOL);
    for(var i in lines){
      var line = lines[i];
      api.log('! ' + line, severity);
    }
    api.log('*', severity);
  }

  api.exceptionHandlers.reporters.push(consoleReporter);

  api.exceptionHandlers.report = function(type, err, extraMessages, severity){
    if(severity == null){ severity = 'error'; }
    for(var i in api.exceptionHandlers.reporters){
      var reporter = api.exceptionHandlers.reporters[i];
      reporter(type, err, extraMessages, severity);
    }
  }

  api.exceptionHandlers.renderConnection = function(connection, extraMessages){
    extraMessages.push('! connection details:');
    var relevantDetails = ['action', 'remoteIP', 'type', 'params', 'room'];
    for(var i in relevantDetails){
      if(connection[relevantDetails[i]] != null && typeof connection[relevantDetails[i]] != 'function'){
        extraMessages.push('!     ' + relevantDetails[i] + ': ' + JSON.stringify(connection[relevantDetails[i]]));
      }
    }
  }

  ///////////
  // TYPES //
  ///////////

  api.exceptionHandlers.loader = function(fullFilePath, err){
    var extraMessages = [
      '! Failed to load ' + fullFilePath,
    ];
    api.exceptionHandlers.report('loader', err, extraMessages, 'alert');
  };

  api.exceptionHandlers.action = function(domain, err, connection, next){
    api.stats.increment('exceptions:actions');
    var extraMessages = [];
    try {
      extraMessages.push('! uncaught error from action: ' + connection.action);
    } catch(e){
      extraMessages.push('! uncaught error from action: ' + e.message);
    }
    api.exceptionHandlers.renderConnection(connection, extraMessages)

    api.exceptionHandlers.report('action', err, extraMessages, 'error');

    connection.error = new Error( api.config.errors.serverErrorMessage() );
    connection.response = {}; // no partial responses
    if(typeof next === 'function'){ next(connection, true); }
  };

  api.exceptionHandlers.task = function(err, queue, task){
    api.stats.increment('exceptions:tasks');
    var extraMessages = [];
    try {
      extraMessages.push('! uncaught error from task: ' + task.class + ' on queue ' + queue);
      extraMessages.push('!     arguments: ' + JSON.stringify(task.args));
    } catch(e){
      extraMessages.push('! uncaught error from task: ' + e.message + ' on queue ' + queue);
    }
    api.exceptionHandlers.report('task', err, extraMessages, 'error');
  };
  
  next();

}

/////////////////////////////////////////////////////////////////////
// exports
exports.exceptions = exceptions;
