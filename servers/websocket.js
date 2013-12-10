var faye = require('faye');

var websocket = function(api, options, next){

  //////////
  // INIT //
  //////////

  var type = 'websocket'
  var attributes = {
    canChat: true,
    logConnections: true,
    logExits: true,
    sendWelcomeMessage: 200, // delay sending by 200ms
    fayeChannelPrefix: '/client/websocket/connection/',
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
  var rebroadcastChannel = '/actionHero/websockets/rebroadcast';

  var server = new api.genericServer(type, options, attributes);
  server.connectionsMap = {};

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

  server._teardown = function(next){
    server.connections().forEach(function(connection){
      server.goodbye(connection, 'server shutting down');
    });
    setTimeout(function(){
      next();
    }, 500);
  }

  server.sendMessage = function(connection, message, messageCount){
    if(null === message.context){ message.context = 'response' }
    if(null === messageCount){ messageCount = connection.messageCount }
    if('response' === message.context && null === message.messageCount){ message.messageCount = messageCount }
    var channel = server.attributes.fayeChannelPrefix + connection.rawConnection.uuid;
    api.faye.client.publish(channel, message);
  }

  server.sendFile = function(connection, error, fileStream, mime, length){
    // TODO;
  };

  server.goodbye = function(connection, reason){
    server.sendMessage(connection, {status: 'Bye!', context: 'api', reason: reason});
    delete this.connectionsMap[connection.rawConnection.uuid];
    server.destroyConnection(connection);
  };

  ////////////
  // EVENTS //
  ////////////

  server.on('connection', function(connection){
    server.connectionsMap[connection.rawConnection.uuid] = connection;
  });

  server.on('actionComplete', function(connection, toRender, messageCount){
    if(false !== toRender){
      connection.response.messageCount = messageCount;
      server.sendMessage(connection, connection.response, messageCount)
    }
  });

  /////////////
  // HELPERS //
  /////////////

  api.faye.disconnectHandlers.push(function(clientId){
    for(var uuid in server.connectionsMap){
      if(clientId === server.connectionsMap[uuid].rawConnection.clientId){
        server.goodbye(server.connectionsMap[uuid]);
        break;
      }
    }
  });

  var messagingFayeExtension = function(message, callback){
    // messages for this server (and not AH internals)
    if(0 === message.channel.indexOf(server.attributes.fayeChannelPrefix)){
      if(message.clientId === api.faye.client._clientId){
        callback(message);
      } else {
        var uuid = message.channel.split('/')[4];
        var connection = server.connectionsMap[uuid];
        if(null !== connection){
          incomingMessage(connection, message);
        } else {
          api.faye.client.publish(rebroadcastChannel, {
            serverId:        api.id,
            serverToken:     api.config.general.serverToken,
            originalMessage: message
          });
        }
        callback(message);
      }
    } else {
      callback(message);
    }
  };

  var subscriptionFayeExtension = function(message, callback){
    if(message.channel.indexOf('/meta/subscribe') === 0){
      if(message.subscription.indexOf(server.attributes.fayeChannelPrefix) === 0){
        var uuid = message.subscription.replace(server.attributes.fayeChannelPrefix, '');
        if(null !== server.connectionsMap[uuid]){
          message.error = 'You cannot subscribe to another clients\' channel';
        } else {
          // let the server generate a new connection.id, don't use client-generated UUID
          remoteConnectionDetails(message.clientId, function(details){
            server.buildConnection({
            // will emit 'connection'
              rawConnection  : {
                clientId: message.clientId,
                uuid: uuid
              },
              remoteAddress  : details.remoteIp,
              remotePort     : details.remotePort
            });
          });
        }
      }
    }
    callback(message);
  };

  var incomingRebroadcast = function(message){
    var originalMessage = message.originalMessage;
    var uuid = originalMessage.channel.split('/')[4];
    var connection = server.connectionsMap[uuid];
    if(null !== connection){
      messagingFayeExtension(originalMessage);
    }
  }

  var remoteConnectionDetails = function(clientId, callback){
    var remoteIp = '0.0.0.0';
    var remotePort = 0;

    setTimeout(function(){
      // TODO: This will always be localhost (or the proxy IP) if you front this with nginx, haproxy, etc.
      var fayeConnection = api.faye.server._server._engine._connections[clientId];
      if(fayeConnection && null !== fayeConnection.socket){
        remoteIp   = fayeConnection.socket._socket._stream.remoteAddress;
        remotePort = fayeConnection.socket._socket._stream.remotePort;
      }
      callback({remoteIp: remoteIp, remotePort: remotePort});
    }, 50); // should be enough time for the connection to establish?
  }

  var incomingMessage = function(connection, message){
    if(null !== connection){
      var data = message.data;
      var verb = data.event;
      delete data.event;
      connection.messageCount++;
      if('action' === verb){
        connection.params = data.params;
        connection.error = null;
        connection.response = {};
        server.processAction(connection);
      } else if('file' === verb){
        server.processFile(connection);
      } else {
        var words = []
        for(var i in data){ words.push(data[i]); }
        connection.verbs(verb, words, function(error, data){
          if(null === error){
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
    incoming: messagingFayeExtension
  });

  api.faye.extensions.push({
    incoming: subscriptionFayeExtension
  });

  next(server);
}

/////////////////////////////////////////////////////////////////////
// exports
exports.websocket = websocket;
