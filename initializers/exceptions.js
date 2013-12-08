var exceptions = function(api, next){

  api.exceptionHandlers = {};
  api.exceptionHandlers.renderError = function(err){
    var lines = err.stack.split('\n');
    lines.forEach(function(line){
      api.log('! ' + line, 'error');
    });
    api.log('*', 'error');
  };

  api.exceptionHandlers.loader = function(fullFilePath, err){
    api.log('! Failed to load ' + fullFilePath, 'alert');
    api.exceptionHandlers.renderError(err);
  };

  api.exceptionHandlers.action = function(domain, err, connection, next){
    api.stats.increment('exceptions:actions');
    try {
      api.log('! uncaught error from action: ' + connection.action, 'alert');
    } catch(e){
      api.log('! uncaught error from action: ' + e.message, 'alert');
    }
    api.exceptionHandlers.renderConnection(connection);
    api.exceptionHandlers.renderError(err);
    connection.error = new Error(api.config.general.serverErrorMessage);
    connection.response = {}; // no partial responses
    // domain.dispose();
    next(connection, true);
  };
  api.exceptionHandlers.task = function(domain, err, task, next){
    api.stats.increment('exceptions:tasks');
    try {
      api.log('! uncaught error from task: ' + task.name, 'alert');
    } catch(e){
      api.log('! uncaught error from task: ' + e.message, 'alert');
    }
    api.exceptionHandlers.renderError(err);
    // domain.dispose();
    if(typeof next == 'function'){ next(false) }
  };
  ///
  api.exceptionHandlers.renderConnection = function(connection){
    api.log('! connection details:', 'error');
    var relevantDetails = ['action', 'remoteIP', 'type', 'params', 'room'];
    for(var i in relevantDetails){
      if(connection[relevantDetails[i]] != null && typeof connection[relevantDetails[i]] != 'function'){
        api.log('!     ' + relevantDetails[i] + ': ' + JSON.stringify(connection[relevantDetails[i]]), 'error');
      }
    }

  }
  next();

}

/////////////////////////////////////////////////////////////////////
// exports
exports.exceptions = exceptions;
