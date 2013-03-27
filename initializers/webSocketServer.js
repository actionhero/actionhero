var faye = require('faye');

var webSocketServer = function(api, next){

  if(api.configData.webSockets.enable != true){
    next()
  }else{
    api.webSocketServer = {};
    api.webSocketServer.fayeChannelPrefix = "/client/websocket/connection/"
    api.webSocketServer.connectionsMap = {};

    api.webSocketServer._start = function(api, next){
      api.faye.server.attach(api.webServer.server);
      api.log("webSockets bound to " + api.configData.httpServer.port + " mounted at " + api.configData.faye.mount, "notice"); 

      api.faye.disconnectHandlers.push(function(clientId){
        api.webSocketServer.destroyClient(clientId);
      });

      next();
    }

    api.webSocketServer._teardown = function(api, next){
      next();
    }

    api.faye.extensions.push({
      incoming: function(message, callback){
        if(message.channel.indexOf(api.webSocketServer.fayeChannelPrefix) === 0){
          if(message.clientId === api.faye.client._clientId){
            callback(message);
          }else{
            api.webSocketServer.incommingMessage(message);
            callback(null);
          }
        }else if(message.channel.indexOf('/meta/subscribe') === 0){
          if(message.subscription.indexOf(api.webSocketServer.fayeChannelPrefix) === 0){
            if(message.clientId != message.subscription.split("/")[4]){
              message.error = "You cannot subscribe to another client's channel";
            }else{
              api.webSocketServer.createClient(message.clientId);
            }
          }
          callback(message);
        }else{
          callback(message);
        }
      }
    });

    api.webSocketServer.createClient = function(clientId){
      var connection = new api.connection({
        type: 'webSocket', 
        remotePort: 0, 
        remoteIP: 0,
        clientId: clientId,
        rawConnection: {
          clientId: clientId,
        }
      });
      connection.sendMessage = function(message){
        var channel = api.webSocketServer.fayeChannelPrefix + this.rawConnection.clientId;
        api.faye.client.publish(channel, message);
      };
      api.webSocketServer.connectionsMap[clientId] = connection;
      setTimeout(function(){
        connection.sendMessage({welcome: api.configData.general.welcomeMessage, room: connection.room, context: "api"});
        api.log("connection @ webSocket", "info", {to: connection.remoteIP});
      }, 100);
    }

    api.webSocketServer.destroyClient = function(clientId){
      var connection = api.webSocketServer.connectionsMap[clientId];
      if(connection){
        clearTimeout(connection.welcomeTimer);
        connection.destroy(function(){
          delete api.webSocketServer.connectionsMap[clientId];
          api.log("disconnect @ webSocket", "info", {to: connection.remoteIP});
        });
      }
    }

    api.webSocketServer.renderActionResponse = function(proxy_connection, toRender){
      var connection = proxy_connection._original_connection;
      connection.response = proxy_connection.response;
      connection.error = proxy_connection.error;
      var delta = new Date().getTime() - connection.actionStartTime;          
      
      if(toRender != false){
        if(connection.response.context == "response"){
          if(proxy_connection.respondingTo != null){
            connection.response.messageCount = proxy_connection.respondingTo;
          }else if(proxy_connection.messageCount != null){
            connection.response.messageCount = proxy_connection.messageCount;
          }else{
            connection.response.messageCount = connection.messageCount;
          }
        }
        if(connection.error != null && connection.response.error == null){ 
          connection.response.error = String(connection.error);
        }
        connection.sendMessage(connection.response)
      }

      api.log("action @ webSocket", "info", {
        to: connection.remoteIP, 
        params: JSON.stringify(proxy_connection.params), 
        action: proxy_connection.action, 
        duration: delta, 
        error: String(proxy_connection.error)
      });
    }

    api.webSocketServer.incommingMessage = function(message){
      var clientId = message.channel.split("/")[4];
      var connection = api.webSocketServer.connectionsMap[clientId];
      if(connection != null){
        var data = message.data;
        var event = data.event;
        delete data.event;

        connection.messageCount++;

        if(event == "action"){
          if(data == null){ data = {}; }
          connection.params = data.params;
          connection.error = null;
          connection.actionStartTime = new Date().getTime();
          connection.response = {};
          connection.response.context = "response";
          // actions should be run using params set at the begining of excecution
          // build a proxy connection so that param changes during execution will not break this
          var proxy_connection = {
            _original_connection: connection
          }
          for (var i in connection) {
            if (connection.hasOwnProperty(i)) {
              proxy_connection[i] = connection[i];
            }
          }
          var actionProcessor = new api.actionProcessor({connection: proxy_connection, callback: api.webSocketServer.renderActionResponse});
          actionProcessor.processAction();
        }

        else if(event == "setIP"){
          connection.remoteIP = data.ip;
          connection.sendMessage({context: "response", status: "OK", messageCount: connection.messageCount});
          api.log("setIP @ webSocket", "debug", {clientId: connection.rawConnection.clientId, params: JSON.stringify(data)});
        }

        else if(event == "say"){
          api.chatRoom.socketRoomBroadcast(connection, data.message);
          connection.sendMessage({context: "response", status: "OK", messageCount: connection.messageCount});
          api.log("say @ webSocket", "debug", {to: connection.remoteIP, params: JSON.stringify(data)});
        }

        else if(event == "roomView"){
          api.chatRoom.socketRoomStatus(connection.room, function(err, roomStatus){
            connection.sendMessage({context: "response", status: "OK", room: connection.room, roomStatus: roomStatus, messageCount: connection.messageCount});
            api.log("roomView @ webSocket", "debug", {to: connection.remoteIP, params: JSON.stringify(data)});
          });
        }

        else if(event == "roomChange"){
          api.chatRoom.roomRemoveMember(connection, function(err, wasRemoved){
            connection.room = data.room;
            api.chatRoom.roomAddMember(connection);
            connection.sendMessage({context: "response", status: "OK", room: connection.room, messageCount: connection.messageCount});
            api.log("roomChange @ webSocket", "debug", {to: connection.remoteIP, params: JSON.stringify(data)});
          });
        }

        else if(event == "listenToRoom"){
          var message = {context: "response", messageCount: connection.messageCount, room: data.room}
          if(connection.additionalListeningRooms.indexOf(data.room) > -1){
            message.error = "you are already listening to this room";
          }else{
            connection.additionalListeningRooms.push(data.room);
            message.status = "OK"
          }
          connection.sendMessage(message);
          api.log("listenToRoom @ webSocket", "debug", {to: connection.remoteIP, params: JSON.stringify(data)});
        }

        else if(event == "silenceRoom"){
          var message = {context: "response", messageCount: connection.messageCount, room: data.room}
          if(connection.additionalListeningRooms.indexOf(data.room) > -1){
            var index = connection.additionalListeningRooms.indexOf(data.room);
            connection.additionalListeningRooms.splice(index, 1);
            message.status = "OK";
          }else{
            connection.additionalListeningRooms.push(data.room);
            message.error = "you are not listening to this room";
          }
          connection.sendMessage(message);
          api.log("silenceRoom @ webSocket", "debug", {to: connection.remoteIP, params: JSON.stringify(data)});
        }

        else if(event == "detailsView"){
          var details = {
            params: connection.params,
            id: connection.id,
            remoteIP: connection.remoteIP,
            connectedAt: connection.connectedAt,
            room: connection.room,
            totalActions: connection.totalActions,
            pendingActions: connection.pendingActions,
          };
          connection.sendMessage({context: "response", status: "OK", details: details, messageCount: connection.messageCount});
          api.log("detailsView @ webSocket", "debug", {to: connection.remoteIP, params: JSON.stringify(data)});
        }

      }
    }

    next();
    
  }
}

/////////////////////////////////////////////////////////////////////
// exports
exports.webSocketServer = webSocketServer;
