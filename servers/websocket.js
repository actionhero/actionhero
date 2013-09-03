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

  var server = new api.genericServer(type, options, attributes);
  server.connectionsMap = {};

  //////////////////////
  // REQUIRED METHODS //
  //////////////////////

  server._start = function(next){
    var webserver = api.servers.servers["web"];
    api.faye.server.attach(webserver.server);
    api.log("webSockets bound to " + webserver.options.bindIP + ":" + webserver.options.port + " mounted at " + api.configData.faye.mount, "notice"); 

    next();
  }

  server._teardown = function(next){
    // nothing to do; faye is handled by core and the http server will shut down on its own
    next();
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

  api.faye.extensions.push({
    incoming: function(message, callback){
      // messages for this server (and not AH internals)
      if(message.channel.indexOf(server.attributes.fayeChannelPrefix) === 0){
        if(message.clientId === api.faye.client._clientId){
          callback(message);
        }else{
          incommingMessage(message);
          callback(null); // don't pass the message on
        }
      }else if(message.channel.indexOf('/meta/subscribe') === 0){
        if(message.subscription.indexOf(server.attributes.fayeChannelPrefix) === 0){
          var uuid = message.subscription.replace(server.attributes.fayeChannelPrefix, "");
          if(server.connectionsMap[uuid] != null){
            message.error = "You cannot subscribe to another client's channel";
          }else{
            var details = remoteConnectionDetails(message.clientId);
            server.buildConnection({
              rawConnection  : { 
                clientId: message.clientId,
                uuid: uuid,
              }, 
              remoteAddress  : details.remoteIp,
              remotePort     : details.remotePort 
            }); // will emit "connection"
          }
        }
        callback(message);
      }else{
        callback(message);
      }
    }
  });

  var remoteConnectionDetails = function(clientId){
    var remoteIp = "0.0.0.0"
    var remotePort = 0
    var fayeConnection = api.faye.server._server._engine._connections[clientId];
    if(fayeConnection && fayeConnection.socket != null){
      remoteIp =   fayeConnection.socket._socket._stream.remoteAddress;
      remotePort = fayeConnection.socket._socket._stream.remotePort
    }
    return {remoteIp: remoteIp, remotePort: remotePort};
  }

  var incommingMessage = function(message){
    var uuid = message.channel.split("/")[4];
    var connection = server.connectionsMap[uuid];
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

  next(server);
}

/////////////////////////////////////////////////////////////////////
// exports
exports.websocket = websocket;
