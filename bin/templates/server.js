var %%name%% = function(api, options, next){

  //////////
  // INIT //
  //////////

  var type = '%%name%%'
  var attributes = {
    canChat: true,
    logConnections: true,
    logExits: true,
    sendWelcomeMessage: true,
    verbs: [],
  }

  var server = new api.genericServer(type, options, attributes);

  //////////////////////
  // REQUIRED METHODS //
  //////////////////////

  server._start = function(next){
    next();
  }

  server._stop = function(next){
    next();
  }

  server.sendMessage = function(connection, message, messageCount){

  }

  server.sendFile = function(connection, error, fileStream, mime, length){

  };

  server.goodbye = function(connection, reason){

  };

  ////////////
  // EVENTS //
  ////////////

  server.on('connection', function(connection){

  });

  server.on('actionComplete', function(connection, toRender, messageCount){
    
  });

  /////////////
  // HELPERS //
  /////////////

  next(server);
}

exports.%%name%% = %%name%%;