'use strict';

var os = require('os');

module.exports = {
  loadPriority:  130,
  initialize: function(api, next){

    api.exceptionHandlers = {};
    api.exceptionHandlers.reporters = [];

    var consoleReporter = function(error, type, name, objects, severity){
      var extraMessages = [];

      if(type === 'loader'){
        extraMessages.push('! Failed to load ' + objects.fullFilePath);
      }else if(type === 'action'){
        extraMessages.push('! uncaught error from action: ' + name);
        extraMessages.push('! connection details:');
        var relevantDetails = ['action', 'remoteIP', 'type', 'params', 'room'];
        for(var i in relevantDetails){
          if(
            objects.connection[relevantDetails[i]] !== null &&
            objects.connection[relevantDetails[i]] !== undefined &&
            typeof objects.connection[relevantDetails[i]] !== 'function'
          ){
            extraMessages.push('!     ' + relevantDetails[i] + ': ' + JSON.stringify(objects.connection[relevantDetails[i]]));
          }
        }
      }else if(type === 'task'){
        extraMessages.push('! uncaught error from task: ' + name + ' on queue ' + objects.queue + ' (worker #' + objects.workerId + ')');
        try{
          extraMessages.push('!     arguments: ' + JSON.stringify(objects.task.args));
        }catch(e){}
      }else{
        extraMessages.push('! Error: ' + error.message);
        extraMessages.push('!     Type: ' + type);
        extraMessages.push('!     Name: ' + name);
        extraMessages.push('!     Data: ' + JSON.stringify(objects));
      }

      for(var m in extraMessages){
        api.log(extraMessages[m], severity);
      }
      var lines;
      try{
        lines = error.stack.split(os.EOL);
      }catch(e){
        lines = new Error(error).stack.split(os.EOL);
      }
      for(var l in lines){
        var line = lines[l];
        api.log('! ' + line, severity);
      }
      api.log('*', severity);
    };

    api.exceptionHandlers.reporters.push(consoleReporter);

    api.exceptionHandlers.report = function(error, type, name, objects, severity){
      if(!severity){ severity = 'error'; }
      for(var i in api.exceptionHandlers.reporters){
        api.exceptionHandlers.reporters[i](error, type, name, objects, severity);
      }
    };

    ///////////
    // TYPES //
    ///////////

    api.exceptionHandlers.loader = function(fullFilePath, error){
      var name = 'loader:' + fullFilePath;
      api.exceptionHandlers.report(error, 'loader', name, {fullFilePath: fullFilePath}, 'alert');
    };

    api.exceptionHandlers.action = function(error, data, next){
      var simpleName;
      try{
        simpleName = data.action;
      }catch(e){
        simpleName = error.message;
      }
      var name = 'action:' + simpleName;
      api.exceptionHandlers.report(error, 'action', name, {connection: data.connection}, 'error');
      data.connection.response = {}; // no partial responses
      if(typeof next === 'function'){ next(); }
    };

    api.exceptionHandlers.task = function(error, queue, task, workerId){
      var simpleName;
      try{
        simpleName = task['class'];
      }catch(e){
        simpleName = error.message;
      }
      var name = 'task:' + simpleName;
      api.exceptionHandlers.report(error, 'task', name, {task: task, queue: queue, workerId: workerId}, api.config.tasks.workerLogging.failure);
    };

    next();

  }
};
