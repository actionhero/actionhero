var socket_io = require('socket.io');

var webSocketServer = function(api, next){

  if(api.configData.webSockets.enable != true){
    next()
  }else{
    api.webSocketServer = {};

    api.webSocketServer._start = function(api, next){

      var io = socket_io.listen(api.webServer.server, { 'log level': 0 });

      if(api.configData.webSockets.logLevel != null){
        io.set('log level', api.configData.webSockets.logLevel);
      }else{
        io.set('log level', 1);
      }

      if(api.configData.webSockets.settings != null){
        for (var i in api.configData.webSockets.settings){
          io.enable(api.configData.webSockets.settings[i]); 
        }
      }

      if(api.configData.webSockets.options != null){
        for (var i in api.configData.webSockets.options){
          io.set(i, api.configData.webSockets.options[i]); 
        }
      }

      var c = api.configData.redis;
      if(c.enable == true){
        var RedisStore = require('socket.io/lib/stores/redis');
        var completeRedisInit = function(){
          if(c.enable == true){
            io.set('store', new RedisStore({
              redisPub : api.redis.client,
              redisSub : api.redis.clientSubscriber,
              redisClient : api.redis.client
            }));
          }
        }
      }

      io.sockets.on('connection', function(connection){
        api.webSocketServer.handleConnnection(connection);
      });

      api.webSocketServer.io = io;
      api.log("webSockets bound to " + api.configData.httpServer.port, "notice");
      next();
    }

    api.webSocketServer._teardown = function(api, next){
      api.webSocketServer.disconnectAll(function(){
        api.webServer.server.close();
        next();
      });
    }

    api.webSocketServer.decorateConnection = function(connection){
      connection.sendMessage = function(message, type){
        if(type == null){ type = 'say'; }
        connection.rawConnection.emit(type, message);
      }
    }

    api.webSocketServer.handleConnnection = function(rawConnection){
      var connection = new api.connection({
        type: 'webSocket', 
        remotePort: rawConnection.handshake.address.port, 
        remoteIP: rawConnection.handshake.address.address, 
        rawConnection: rawConnection
      });
      api.webSocketServer.decorateConnection(connection);
      api.log("connection @ webSocket", "info", {to: connection.remoteIP});

      var welcomeMessage = {welcome: api.configData.general.welcomeMessage, room: connection.room, context: "api"};
      connection.sendMessage(welcomeMessage, 'welcome');

      rawConnection.on('exit', function(data){ connection.disconnect(); });
      rawConnection.on('quit', function(data){ connection.disconnect(); });
      rawConnection.on('close', function(data){ connection.disconnect(); });
      
      rawConnection.on('roomView', function(data){
        if(data == null){ data = {}; }
        api.chatRoom.socketRoomStatus(connection.room, function(err, roomStatus){
          connection.messageCount++; 
          connection.sendMessage({context: "response", status: "OK", room: connection.room, roomStatus: roomStatus, messageCount: connection.messageCount}, "response")
          api.log("roomView @ webSocket", "debug", {to: connection.remoteIP, params: JSON.stringify(data)});
        });
      });

      rawConnection.on('roomChange', function(data){
        if(data == null){ data = {}; }
        api.chatRoom.roomRemoveMember(connection, function(err, wasRemoved){
          connection.room = data.room;
          api.chatRoom.roomAddMember(connection);
          connection.messageCount++; 
          connection.sendMessage({context: "response", status: "OK", room: connection.room, messageCount: connection.messageCount}, "response")
          api.log("roomChange @ webSocket", "debug", {to: connection.remoteIP, params: JSON.stringify(data)});
        });
      });

      rawConnection.on('listenToRoom', function(data){
        if(data == null){ data = {}; }
        connection.messageCount++; 
        var message = {context: "response", messageCount: connection.messageCount, room: data.room}
        if(connection.additionalListeningRooms.indexOf(data.room) > -1){
          message.error = "you are already listening to this room";
        }else{
          connection.additionalListeningRooms.push(data.room);
          message.status = "OK"
        }
        connection.sendMessage(message, "response")
        api.log("listenToRoom @ webSocket", "debug", {to: connection.remoteIP, params: JSON.stringify(data)});
      });

      rawConnection.on('silenceRoom', function(data){
        if(data == null){ data = {}; }
        connection.messageCount++; 
        var message = {context: "response", messageCount: connection.messageCount, room: data.room}
        if(connection.additionalListeningRooms.indexOf(data.room) > -1){
          var index = connection.additionalListeningRooms.indexOf(data.room);
          connection.additionalListeningRooms.splice(index, 1);
          message.status = "OK";
        }else{
          connection.additionalListeningRooms.push(data.room);
          message.error = "you are not listening to this room";
        }
        connection.sendMessage(message, "response");
        api.log("silenceRoom @ webSocket", "debug", {to: connection.remoteIP, params: JSON.stringify(data)});
      });

      rawConnection.on('say', function(data){
        if(data == null){ data = {}; }
        var message = data.message;
        api.chatRoom.socketRoomBroadcast(connection, message);
        connection.messageCount++; 
        connection.sendMessage({context: "response", status: "OK", messageCount: connection.messageCount}, "response")
        api.log("say @ webSocket", "debug", {to: connection.remoteIP, params: JSON.stringify(data)});
      }); 

      rawConnection.on('detailsView', function(data){
        if(data == null){ data = {}; }
        var details = {};
        details.params = connection.params;
        details.id = connection.id;
        details.connectedAt = connection.connectedAt;
        details.room = connection.room;
        details.totalActions = connection.totalActions;
        details.pendingActions = connection.pendingActions;
        connection.messageCount++; 
        connection.sendMessage({context: "response", status: "OK", details: details, messageCount: connection.messageCount}, "response")
        api.log("detailsView @ webSocket", "debug", {to: connection.remoteIP, params: JSON.stringify(data)});
      });

      rawConnection.on('action', function(data){
        if(data == null){ data = {}; }
        connection.params = data;
        connection.error = null;
        connection.actionStartTime = new Date().getTime();
        connection.response = {};
        connection.response.context = "response";
        connection.messageCount++; 

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

        var actionProcessor = new api.actionProcessor({connection: proxy_connection, callback: api.webSocketServer.handleActionResponse});
        actionProcessor.processAction();
      });

      rawConnection.on('disconnect', function(){
        connection.destroy(function(){
          delete rawConnection;
          api.log("disconnect @ webSocket", "info", {to: connection.remoteIP});
        });
      });
    }

    api.webSocketServer.handleActionResponse = function(proxy_connection, cont){
      var connection = proxy_connection._original_connection;
      connection.response = proxy_connection.response;
      connection.error = proxy_connection.error;
      var delta = new Date().getTime() - connection.actionStartTime;          
      api.webSocketServer.respondToWebSocketClient(connection, cont, proxy_connection.respondingTo);
      api.log("action @ webSocket", "info", {
        to: connection.remoteIP, 
        params: JSON.stringify(proxy_connection.params), 
        action: proxy_connection.action, 
        duration: delta, 
        error: String(proxy_connection.error)
      });
    }

    api.webSocketServer.respondToWebSocketClient = function(connection, cont, respondingTo){
      if(cont != false){
        if(connection.response.context == "response"){
          if(respondingTo != null){
            connection.response.messageCount = respondingTo;
          }else{
            connection.response.messageCount = connection.messageCount;
          }
        }
        if(connection.error != null){ 
          if(connection.response.error == null){
            connection.response.error = String(connection.error);
          }
        }
        connection.sendMessage(connection.response, connection.response.context)
      }
    }

    api.webSocketServer.disconnectAll = function(next){
      for( var i in api.connections.connections ){
        if(api.connections.connections[i].type == "webSocket"){
          api.connections.connections[i].sendMessage({bye: "bye", reason: "server shutdown"});
          api.connections.connections[i].rawConnection.disconnect();
          delete api.connections.connections[i];
        }
      }
      if(typeof next == "function"){ next(); }
    }

    next();
    
  }
}

/////////////////////////////////////////////////////////////////////
// exports
exports.webSocketServer = webSocketServer;
