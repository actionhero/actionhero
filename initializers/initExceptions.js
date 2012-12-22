////////////////////////////////////////////////////////////////////////////
// error handling for unCaught exceptions from tasks and actions
// I make use of node.js domains, so I am only availalbe for node v0.8.0 and higher

var initExceptions = function(api, next){
  api.exceptionHandlers = {};

  api.exceptionHandlers.renderError = function(err){
    var lines = err.stack.split("\n");
    lines.forEach(function(line){
      api.log("! " + line, "red");
    });
    api.log("*", "red");
  };

  api.exceptionHandlers.loader = function(fullFilePath, err){
    api.log("! Failed to load " + fullFilePath, ["red", "bold"]);
    api.exceptionHandlers.renderError(err);
  };

  if(api.domain != null){
    api.exceptionHandlers.action = function(domain, err, connection, next){
      api.log("! uncaught error from action: " + connection.action, ["red","bold"]);
      api.exceptionHandlers.renderConnection(connection);
      api.exceptionHandlers.renderError(err);
      connection.error = new Error(api.configData.general.serverErrorMessage);
      connection.response = {}; // no partial responses
      if(connection.type == "web"){
        connection.responseHttpCode = 500;
      }
      // domain.dispose();
      next(connection, true);
    };
    api.exceptionHandlers.task = function(domain, err, task, next){
      api.log("! uncaught error from task: " + task.name, ["red","bold"]);
      api.exceptionHandlers.renderError(err);
      // domain.dispose();
      if(typeof next == "function"){ next(false); }
    };
    ///
    api.exceptionHandlers.renderConnection = function(connection){
      api.log("! connection details:", "red");
      var releventDetails = ["action", "remoteIP", "type", "params", "room"];
      for(var i in releventDetails){
        if(connection[releventDetails[i]] != null && typeof connection[releventDetails[i]] != 'function'){
          api.log("!     " + releventDetails[i] + ": " + JSON.stringify(connection[releventDetails[i]]), "red");
        }
      }
    }

  }
  next();

}

/////////////////////////////////////////////////////////////////////
// exports
exports.initExceptions = initExceptions;
