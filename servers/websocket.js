var faye = require('faye');

var websocket = function(api, options, next){
  
  //////////
  // INIT //
  //////////

  var type = "websocket"
  var attributes = {
    canChat: true,
    logConnections: true,
    logExits: true,
    sendWelcomeMessage: 200, // delay sending by 200ms
    fayeChannelPrefix: "/client/websocket/connection/",
    verbs: [
      "quit",
      "exit",
      "documentation",
      "roomChange",
      "roomView",
      "listenToRoom",
      "silenceRoom",
      "detailsView",
      "say",
    ]
  }
  var rebroadcastChannel = "/actionHero/websockets/rebroadcast";

  var server = new api.genericServer(type, options, attributes);
  server.connectionsMap = {};

  //////////////////////
  // REQUIRED METHODS //
  //////////////////////

  server._start = function(next){
    var webserver = api.servers.servers["web"];
    api.faye.server.attach(webserver.server);
    api.log("webSockets bound to " + webserver.options.bindIP + ":" + webserver.options.port + " mounted at " + api.configData.faye.mount, "notice"); 

    server.subscription = api.faye.client.subscribe(rebroadcastChannel, function(message) {
      incommingRebroadcast(message);
    });

    next();
  }

  server._teardown = function(next){
    server.connections().forEach(function(connection){
      server.goodbye(server.connectionsMap[connection.rawConnection.uuid], "server shutting down");
    });
    setTimeout(function(){
      next();
    }, 500);
  }

  server.sendMessage = function(connection, message, messageCount){
    if(message.context == null){ message.context = 'response'; }
    if(messageCount == null){ messageCount = connection.messageCount; }
    if(message.context === 'response' && message.messageCount == null){ message.messageCount = messageCount; }
    var channel = server.attributes.fayeChannelPrefix + connection.rawConnection.uuid;
    api.faye.client.publish(channel, message);
  }

  server.sendFile = function(connection, error, fileStream, mime, length){
    // TODO;
  };

  server.goodbye = function(connection, reason){
    server.sendMessage(connection, {status: "Bye!", context: "api", reason: reason});
    delete this.connectionsMap[connection.rawConnection.uuid];
    server.destroyConnection(connection);
  };

  ////////////
  // EVENTS //
  ////////////

  server.on("connection", function(connection){
    server.connectionsMap[connection.rawConnection.uuid] = connection;
  });

  server.on("actionComplete", function(connection, toRender, messageCount){
    if(toRender != false){
      connection.response.messageCount = messageCount;
      server.sendMessage(connection, connection.response, messageCount)
    }
  });

  /////////////
  // HELPERS //
  /////////////

  api.faye.disconnectHandlers.push(function(clientId){
    for(var uuid in server.connectionsMap){
      if(server.connectionsMap[uuid].rawConnection.clientId == clientId){
        server.goodbye(server.connectionsMap[uuid]);
        break;
      }
    }
  });

  var messagingFayeExtansion = function(message, callback){
    // messages for this server (and not AH internals)
    if(message.channel.indexOf(server.attributes.fayeChannelPrefix) === 0){
      if(message.clientId === api.faye.client._clientId){
        if(typeof callback == "function"){ callback(message); }
      }else{
        var uuid = message.channel.split("/")[4];
        var connection = server.connectionsMap[uuid];
        if(connection != null){
          incommingMessage(connection, message);
        }else{
          api.faye.client.publish(rebroadcastChannel, {
            serverId: api.id,
            serverToken: api.configData.general.serverToken,
            originalMessage: message,
          });
        }
        if(typeof callback == "function"){ callback(null); }
      }
    }else{
      if(typeof callback == "function"){ callback(message); }
    } 
  };

  var subscriptionFayeExtansion = function(message, callback){
    if(message.channel.indexOf('/meta/subscribe') === 0){
      if(message.subscription.indexOf(server.attributes.fayeChannelPrefix) === 0){
        var uuid = message.subscription.replace(server.attributes.fayeChannelPrefix, "");
        if(server.connectionsMap[uuid] != null){
          message.error = "You cannot subscribe to another client's channel";
        }else{
          // let the server generate a new connection.id, don't use client-generated UUID
          remoteConnectionDetails(message.clientId, function(details){
            server.buildConnection({
              rawConnection  : { 
                clientId: message.clientId,
                uuid: uuid,
              }, 
              remoteAddress  : details.remoteIp,
              remotePort     : details.remotePort 
            }); // will emit "connection"
          });
        }
      }
    }
    if(typeof callback == "function"){ callback(message); }
  };

  var incommingRebroadcast = function(message){
    var originalMessage = message.originalMessage;
    var uuid = originalMessage.channel.split("/")[4];
    var connection = server.connectionsMap[uuid];
    if(connection != null){
      messagingFayeExtansion(originalMessage);
    }
  }

  var remoteConnectionDetails = function(clientId, callback){
    var remoteIp = "0.0.0.0";
    var remotePort = 0;

    setTimeout(function(){
      // TODO: This will always be localhost (or the proxy's IP) if you front this with nginx, haproxy, etc.
      var fayeConnection = api.faye.server._server._engine._connections[clientId];
      if(fayeConnection && fayeConnection.socket != null){
        remoteIp =   fayeConnection.socket._socket._stream.remoteAddress;
        remotePort = fayeConnection.socket._socket._stream.remotePort; 
      }
      callback({remoteIp: remoteIp, remotePort: remotePort});
    }, 50); // should be enough time for the connection to establish?
  }

  var incommingMessage = function(connection, message){
    if(connection != null){
      var data = message.data;
      var verb = data.event;
      delete data.event;
      connection.messageCount++;
      if(verb == "action"){
        connection.params = data.params;
        connection.error = null;
        connection.response = {};
        server.processAction(connection);
      }else if(verb == "file"){
        server.processFile(connection);
      }else{
        var words = []
        for(var i in data){ words.push(data[i]); }
        connection.verbs(verb, words, function(error, data){
          if(error == null){
            var message = {status: "OK", context: "response", data: data};
            server.sendMessage(connection, message);
          }else{
            var message = {status: error, context: "response", data: data}
            server.sendMessage(connection, message);
          }
        });
      }
    }
  }

  api.faye.extensions.push({
    incoming: messagingFayeExtansion
  });

  api.faye.extensions.push({
    incoming: subscriptionFayeExtansion
  });

  next(server);
}

/////////////////////////////////////////////////////////////////////
// exports
exports.websocket = websocket;
