var os = require('os');

var exceptions = function(api, next){

  api.exceptionHandlers = {};
  api.exceptionHandlers.reporters = [];

  var consoleReporter = function(err, type, name, objects, severity){
    var extraMessages = [];
    
    if(type === 'loader'){
      extraMessages.push('! Failed to load ' + objects.fullFilePath)
    }

    else if(type === 'action'){
      extraMessages.push('! uncaught error from action: ' + name);
      extraMessages.push('! connection details:');
      var relevantDetails = ['action', 'remoteIP', 'type', 'params', 'room'];
      for(var i in relevantDetails){
        if(objects.connection[relevantDetails[i]] != null && typeof objects.connection[relevantDetails[i]] != 'function'){
          extraMessages.push('!     ' + relevantDetails[i] + ': ' + JSON.stringify(objects.connection[relevantDetails[i]]));
        }
      }
    }

    else if(type === 'task'){
      extraMessages.push('! uncaught error from task: ' + name + ' on queue ' + objects.queue);
      extraMessages.push('!     arguments: ' + JSON.stringify(objects.task.args));
    }

    else {
      extraMessages.push('! Error: ' + err.message);
      extraMessages.push('!     Type: ' + type);
      extraMessages.push('!     Name: ' + name);
      extraMessages.push('!     Data: ' + JSON.stringify(objects));
    }

    for(var i in extraMessages){
      api.log(extraMessages[i], severity);
    }
    var lines = err.stack.split(os.EOL);
    for(var i in lines){
      var line = lines[i];
      api.log('! ' + line, severity);
    }
    api.log('*', severity);
  }

  api.exceptionHandlers.reporters.push(consoleReporter);

  api.exceptionHandlers.report = function(err, type, name, objects, severity){
    if(severity == null){ severity = 'error'; }
    for(var i in api.exceptionHandlers.reporters){
      api.exceptionHandlers.reporters[i](err, type, name, objects, severity);
    }
  }

  ///////////
  // TYPES //
  ///////////

  api.exceptionHandlers.loader = function(fullFilePath, err){
    var name = "loader:" + fullFilePath;
    api.exceptionHandlers.report(err, 'loader', name, {fullFilePath: fullFilePath}, 'alert');
  };

  api.exceptionHandlers.action = function(domain, err, connection, next){
    try{
      var simpleName = connection.action;
    }catch(e){
      var simpleName = err.message;
    }
    var name = 'action:' + simpleName;
    api.stats.increment('exceptions:actions');
    api.stats.increment('exceptions:actions:' + simpleName);    
    api.exceptionHandlers.report(err, 'action', name, {connection: connection}, 'error');
    connection.error = new Error( api.config.errors.serverErrorMessage() );
    connection.response = {}; // no partial responses
    if(typeof next === 'function'){ next(connection, true); }
  };

  api.exceptionHandlers.task = function(err, queue, task){
    try{
      var simpleName = task.class;
    }catch(e){
      var simpleName = err.message;
    }
    var name = 'task:' + simpleName;
    api.stats.increment('exceptions:tasks');
    api.stats.increment('exceptions:tasks:' + simpleName);
    api.exceptionHandlers.report(err, 'task', name, {task: task, queue: queue}, 'error');
  };
  
  next();

}

/////////////////////////////////////////////////////////////////////
// exports
exports.exceptions = exceptions;
