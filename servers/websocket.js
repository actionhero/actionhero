var faye = require('faye');

var websocket = function(api, options, next){

  //////////
  // INIT //
  //////////

  var type = 'websocket'
  var attributes = {
    canChat:               true,
    logConnections:        true,
    logExits:              true,
    sendWelcomeMessage:    200,
    fayeChannelPrefix:     '/client/websocket/connection/',
    setupChannelPrefix:    '/client/websocket/_incoming',
    verbs: [
      'quit',
      'exit',
      'documentation',
      'roomChange',
      'roomLeave',
      'roomView',
      'listenToRoom',
      'silenceRoom',
      'detailsView',
      'say'
    ]
  }
  var rebroadcastChannel = '/actionhero/websockets/rebroadcast';

  var server = new api.genericServer(type, options, attributes);

  //////////////////////
  // REQUIRED METHODS //
  //////////////////////

  server._start = function(next){
    var webserver = api.servers.servers['web'];
    api.faye.server.attach(webserver.server);
    api.log('webSockets bound to ' + webserver.options.bindIP + ':' + webserver.options.port + ' mounted at ' + api.config.faye.mount, 'notice');

    server.subscription = api.faye.client.subscribe(rebroadcastChannel, function(message){
      incomingRebroadcast(message);
    });

    next();
  }

  server._stop = function(next){
    server.connections().forEach(function(connection){
      server.goodbye(connection, 'server shutting down');
    });
    setTimeout(function(){
      next();
    }, 500);
  }

  server.sendMessage = function(connection, message, messageCount){
    if(message.context == null){ message.context = 'response'; }
    if(messageCount == null){ messageCount = connection.messageCount; }
    if(message.context === 'response' && message.messageCount == null){ message.messageCount = messageCount; }
    var channel = server.attributes.fayeChannelPrefix + connection.id;
    api.faye.client.publish(channel, message);
  }

  server.sendFile = function(connection, error, fileStream, mime, length){
    var content = '';
    response = {
      error      : error,
      content    : null,
      mime       : mime,
      length     : length
    };

    try{ 
      if(error == null){
        fileStream.on('data', function(d){ content+= d; });
        fileStream.on('end', function(d){
          response.content = content;
          server.sendMessage(connection, response, connection.messageCount);
        });
      }else{
        server.sendMessage(connection, response, connection.messageCount);
      }
    }catch(e){
      api.log(e, 'warning');
      server.sendMessage(connection, response, connection.messageCount);
    }
  };

  server.goodbye = function(connection, reason){
    server.sendMessage(connection, {status: 'Bye!', context: 'api', reason: reason});
    server.destroyConnection(connection);
  };

  ////////////
  // EVENTS //
  ////////////

  server.on('connection', function(connection){
    var channel = connection.rawConnection.setupChannel;
    var message = {
      id: connection.id,
    };
    api.faye.client.publish(channel, message);
  });

  server.on('actionComplete', function(connection, toRender, messageCount){
    if(toRender != false){
      connection.response.messageCount = messageCount;
      server.sendMessage(connection, connection.response, messageCount)
    }
  });

  /////////////
  // HELPERS //
  /////////////

  api.faye.disconnectHandlers.push(function(clientId){
    var clients = server.connections();
    for(var i in clients){
      if(clients[i].rawConnection.clientId === clientId){
        server.goodbye(clients[i]);
        break;
      }
    }
  });

  var newClientFayeExtension = function(message, callback){
    if(message.channel === '/meta/subscribe' && message.subscription.indexOf(server.attributes.setupChannelPrefix) === 0){
      remoteConnectionDetails(message.clientId, function(details){
        server.buildConnection({
          // id: message.clientId,
          rawConnection  : {
            clientId:     message.clientId,
            setupChannel: message.subscription,
          },
          remoteAddress  : details.remoteIp,
          remotePort     : details.remotePort
        });
      });
    }
    callback(message);
  }

  var messagingFayeExtension = function(message, callback){
    // messages for this server (and not AH internals)
    if(message.channel.indexOf(server.attributes.fayeChannelPrefix) === 0){
      if(message.clientId !== api.faye.client._clientId){
        var connectionId = message.channel.split("/")[4];
        var connection = api.connections.connections[connectionId];
        if(connection != null){
          incomingMessage(connection, message);
        }else{
          api.faye.client.publish(rebroadcastChannel, {
            serverId:        api.id,
            serverToken:     api.config.general.serverToken,
            originalMessage: message
          });
        }
      }
    }
    callback(message);
  };

  var incomingRebroadcast = function(message){
    var originalMessage = message.originalMessage;
    var connectionId = message.channel.split("/")[4];
    var connection = api.connections.connections[connectionId];
    if(connection != null){
      messagingFayeExtension(originalMessage);
    }
  }

  var remoteConnectionDetails = function(clientId, callback){
    var remoteIp = '0.0.0.0';
    var remotePort = 0;

    setTimeout(function(){
      // TODO: This will always be localhost (or the proxy IP) if you front this with nginx, haproxy, etc.
      var fayeConnection = api.faye.server._server._engine._connections[clientId];
      if(fayeConnection && fayeConnection.socket != null){
        remoteIp   = fayeConnection.socket._socket._stream.remoteAddress;
        remotePort = fayeConnection.socket._socket._stream.remotePort;
      }
      callback({remoteIp: remoteIp, remotePort: remotePort});
    }, 50); // should be enough time for the connection to establish?
  }

  var incomingMessage = function(connection, message){
    if(connection != null){
      var data = message.data;
      var verb = data.event;
      delete data.event;
      connection.messageCount++;
      if(verb == 'action'){
        if(api.config.general.disableParamScrubbing) {
          connection.params = data.params;
        } else {
          api.params.postVariables.forEach(function(postVar){
            if(typeof data.params[postVar] !== 'undefined' && data.params[postVar] != null){
              connection.params[postVar] = data.params[postVar];
            }
          });
        }
        
        connection.error = null;
        connection.response = {};
        server.processAction(connection);
      } else if(verb == 'file'){
        connection.params = {
          file: data.file
        }
        server.processFile(connection);
      } else {
        var words = []
        for(var i in data){ words.push(data[i]); }
        connection.verbs(verb, words, function(error, data){
          if(error == null){
            var message = {status: 'OK', context: 'response', data: data};
            server.sendMessage(connection, message);
          } else {
            var message = {status: error, context: 'response', data: data}
            server.sendMessage(connection, message);
          }
        });
      }
    }
  }

  api.faye.extensions.push({
    incoming: newClientFayeExtension
  });  

  api.faye.extensions.push({
    incoming: messagingFayeExtension
  });

  next(server);
}

/////////////////////////////////////////////////////////////////////
// exports
exports.websocket = websocket;
