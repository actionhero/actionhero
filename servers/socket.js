var net = require('net');
var tls = require('tls');
var fs = require('fs');

var socket = function(api, options, next){
  
  //////////
  // INIT //
  //////////

  var type = 'socket'
  var attributes = {
    canChat: true,
    logConnections: true,
    logExits: true,
    pendingShutdownWaitLimit: 5000,
    sendWelcomeMessage: true,
    verbs: [
      'quit',
      'exit',
      'documentation',
      'paramAdd',
      'paramDelete',
      'paramView',
      'paramsView',
      'paramsDelete',
      'roomChange',
      'roomLeave',
      'roomView',
      'listenToRoom',
      'silenceRoom',
      'detailsView',
      'say'
    ]
  }

  var server = new api.genericServer(type, options, attributes);

  //////////////////////
  // REQUIRED METHODS //
  //////////////////////

  server._start = function(next){
    if(false === options.secure){
      server.server = net.createServer(function(rawConnection){
        handleConnection(rawConnection);
      });
    } else {
      server.server = tls.createServer(api.config.servers.socket.serverOptions, function(rawConnection){
        handleConnection(rawConnection);
      });
    }

    server.server.on('error', function(e){
      api.log('Cannot start socket server @ ' + options.bindIP + ':' + options.port + '; Exiting.', 'emerg');
      api.log(e, 'error');
      process.exit();
    });
    
    server.server.listen(options.port, options.bindIP, function(){
      next();
    });
  }

  server._teardown = function(next){
    gracefulShutdown(next);
  }

  server.sendMessage = function(connection, message, messageCount){
    if(null !== connection.respondingTo){
      message.messageCount = messageCount;
      connection.respondingTo = null;
    } else if('response' === message.context){
      if(null !== messageCount){
        message.messageCount = messageCount;
      } else {
        message.messageCount = connection.messageCount;
      }
    }
    try {
      connection.rawConnection.write(JSON.stringify(message) + '\r\n');
    } catch(e){
      api.log('socket write error: ' + e, 'error');
    }
  }

  server.goodbye = function(connection, reason){
    if(null === reason){ reason = 'server shutdown' }
    try {
      connection.rawConnection.end(JSON.stringify({status: 'Bye!', context: 'api', reason: reason}) + '\r\n');
      server.destroyConnection(connection);
    } catch(e){}
  }

  server.sendFile = function(connection, error, fileStream, mime, length){
    if(null !== error){
      server.sendMessage(connection, error, connection.messageCount);
    } else {
      fileStream.pipe(connection.rawConnection, {end: false});
    }
  };

  ////////////
  // EVENTS //
  ////////////

  server.on('connection', function(connection){
    connection.params = {
      limit:  api.config.general.defaultLimit,
      offset: api.config.general.defaultOffset
    }

    connection.rawConnection.on('data', function(chunk){
      if(checkBreakChars(chunk)){
        server.goodbye(connection, 'break-character');
      } else {
        connection.rawConnection.socketDataString += chunk.toString('utf-8').replace(/\r/g, '\n');
        var index, line;
        while((index = connection.rawConnection.socketDataString.indexOf('\n')) > -1) {
          var data = connection.rawConnection.socketDataString.slice(0, index);
          connection.rawConnection.socketDataString = connection.rawConnection.socketDataString.slice(index + 2);
          data.split('\n').forEach(function(line){
            if(line.length > 0){
              // increment at the start of the request so that responses can be caught in order on the client
              // this is not handled by the genericServer
              connection.messageCount++;
              parseRequest(connection, line);
            }
          });
        }
      }
    });

    connection.rawConnection.on('end', function(){
      try { connection.rawConnection.end() } catch(e){}
      server.destroyConnection(connection);
    });

    connection.rawConnection.on('error', function(e){
      server.log('socket error: ' + e, 'error');
      try { connection.rawConnection.end() } catch(e){}
      server.destroyConnection(connection);
    });
  });

  server.on('actionComplete', function(connection, toRender, messageCount){
    if(true === toRender){
      connection.response.context = 'response';
      server.sendMessage(connection, connection.response, messageCount);
    }
  });

  /////////////
  // HELPERS //
  /////////////

  var parseRequest = function(connection, line){
    var words = line.split(' ');
    var verb = words.shift();
    if('file' === verb){
      if(words.length > 0){
        connection.params.file = words[0];
      }
      server.processFile(connection);
    } else {
      connection.verbs(verb, words, function(error, data){
        if(null === error){
          server.sendMessage(connection, {status: 'OK', context: 'response', data: data});
        } else if('verb not found or not allowed' === error){
          // check for and attempt to check single-use params
          try {
            var request_hash = JSON.parse(line);
            if(null !== request_hash['params']){
              connection.params = request_hash['params'];
            }
            if(null !== request_hash['action']){
              connection.params['action'] = request_hash['action'];
            }
          } catch(e){
            connection.params.action = verb;
          }
          connection.error = null;
          connection.response = {};
          server.processAction(connection);
        } else {
          server.sendMessage(connection, {status: error, context: 'response', data: data});
        }
      });
    }
  }

  var handleConnection = function(rawConnection){
    rawConnection.socketDataString = '';
    server.buildConnection({
      rawConnection  : rawConnection,
      remoteAddress  : rawConnection.remoteAddress,
      remotePort     : rawConnection.remotePort
    }); // will emit 'connection'
  }

  // I check for ctrl+c in the stream
  var checkBreakChars = function(chunk){
    var found = false;
    var hexChunk = chunk.toString('hex',0,chunk.length);
    if('fff4fffd06' === hexChunk){
      found = true // CTRL + C
    } else if('04' === hexChunk){
      found = true // CTRL + D
    }
    return found
  }

  var gracefulShutdown = function(next, alreadyShutdown){
    if(null === alreadyShutdown || false === alreadyShutdown){
      server.server.close();
    }
    var pendingConnections = 0;
    server.connections().forEach(function(connection){
      if(0 === connection.pendingActions){
        server.goodbye(connection);
      } else {
        pendingConnections++;
        if(null === connection.rawConnection.shutDownTimer){
          connection.rawConnection.shutDownTimer = setTimeout(function(){
            server.goodbye(connection);
          }, attributes.pendingShutdownWaitLimit);
        }
      }
    });
    if(pendingConnections > 0){
      server.log('waiting on shutdown, there are still ' + pendingConnections + ' connected clients waiting on a response', 'notice');
      setTimeout(function(){
        gracefulShutdown(next, true);
      }, 1000);
    } else if('function' === typeof next){ next() }
  }

  next(server);

}

/////////////////////////////////////////////////////////////////////
// exports
exports.socket = socket;
