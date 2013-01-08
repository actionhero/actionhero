var initWebSockets = function(api, next){

  if(api.configData.webSockets.enable != true){
    next()
  }else{
    api.webSockets = {};

    api.webSockets._start = function(api, next){

      var logger = {
        error: function(original_message){
          api.log( "(socket.io) " + original_message, ["red", "bold"]);
        },
        warn: function(original_message){
          // api.log( "(socket.io) " + original_message, "red");
        },
        info: function(original_message){
          // api.log( "(socket.io) " + original_message);
        },
        debug: function(original_message){
          // api.log( "(socket.io) " + original_message, "grey");
        }
      };

      var io = api.io.listen(api.webServer.server, { 'log level': 0 });

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
        api.stats.increment(api, "webSockets:numberOfRequests");
        api.stats.increment(api, "webSockets:numberOfActiveWebClients");
        api.socketServer.numberOfLocalWebSocketRequests++;

        api.utils.setupConnection(api, connection, "webSocket", connection.handshake.address.port, connection.handshake.address.address);
        api.webSockets.logLine(api, {label: "connect @ webSocket"}, connection);

        var welcomeMessage = {welcome: api.configData.general.welcomeMessage, room: connection.room, context: "api"};
        connection.emit('welcome', welcomeMessage);

        connection.on('exit', function(data){ connection.disconnect(); });
        connection.on('quit', function(data){ connection.disconnect(); });
        connection.on('close', function(data){ connection.disconnect(); });
        
        connection.on('roomView', function(data){
          if(data == null){ data = {}; }
          api.chatRoom.socketRoomStatus(api, connection.room, function(err, roomStatus){
            connection.messageCount++; 
            connection.emit("response", {context: "response", status: "OK", room: connection.room, roomStatus: roomStatus, messageCount: connection.messageCount});
            api.webSockets.logLine(api, {label: "roomView @ webSocket", params: JSON.stringify(data)}, connection, 'grey');
          });
        });

        connection.on('roomChange', function(data){
          if(data == null){ data = {}; }
          api.chatRoom.roomRemoveMember(api, connection, function(err, wasRemoved){
            connection.room = data.room;
            api.chatRoom.roomAddMember(api, connection);
            connection.messageCount++; 
            connection.emit("response", {context: "response", status: "OK", room: connection.room, messageCount: connection.messageCount});
            api.webSockets.logLine(api, {label: "roomChange @ webSocket", params: JSON.stringify(data)}, connection, 'grey');
          });
        });

        connection.on('listenToRoom', function(data){
          if(data == null){ data = {}; }
          var message = {context: "response", messageCount: connection.messageCount, room: data.room}
          if(connection.additionalListeningRooms.indexOf(data.room) > -1){
            message.error = "you are already listening to this room";
          }else{
            connection.additionalListeningRooms.push(data.room);
            message.status = "OK"
          }
          connection.emit("response", message);
          api.webSockets.logLine(api, {label: "listenToRoom @ webSocket", params: JSON.stringify(data)}, connection, 'grey');
        });

        connection.on('silenceRoom', function(data){
          if(data == null){ data = {}; }
          var message = {context: "response", messageCount: connection.messageCount, room: data.room}
          if(connection.additionalListeningRooms.indexOf(data.room) > -1){
            var index = connection.additionalListeningRooms.indexOf(data.room);
            connection.additionalListeningRooms.splice(index, 1);
            message.status = "OK";
          }else{
            connection.additionalListeningRooms.push(data.room);
            message.error = "you are not listening to this room";
          }
          connection.emit("response", message);
          api.webSockets.logLine(api, {label: "silenceRoom @ webSocket", params: JSON.stringify(data)}, connection, 'grey');
        });

        connection.on('say', function(data){
          if(data == null){ data = {}; }
          var message = data.message;
          api.chatRoom.socketRoomBroadcast(api, connection, message);
          connection.messageCount++; 
          connection.emit("response", {context: "response", status: "OK", messageCount: connection.messageCount});
          api.webSockets.logLine(api, {label: "say @ webSocket", params: JSON.stringify(data)}, connection, 'grey');
        }); 

        connection.on('detailsView', function(data){
          if(data == null){ data = {}; }
          var details = {};
          details.params = connection.params;
          details.public = connection.public;
          details.room = connection.room;
          details.totalActions = connection.totalActions;
          details.pendingActions = connection.pendingActions;
          connection.messageCount++; 
          connection.emit("response", {context: "response", status: "OK", details: details, messageCount: connection.messageCount});
          api.webSockets.logLine(api, {label: "detailsView @ webSocket", params: JSON.stringify(data)}, connection, 'grey');
        });

        connection.on('action', function(data){
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
            _original_connection: connection,
          }
          for (var i in connection) {
            if (connection.hasOwnProperty(i)) {
              proxy_connection[i] = connection[i];
            }
          }

          var actionProcessor = new api.actionProcessor({connection: proxy_connection, callback: api.webSockets.handleActionResponse});
          actionProcessor.processAction();
        });

        connection.on('disconnect', function(){
          api.stats.increment(api, "webSockets:numberOfActiveWebClients", -1);
          api.utils.destroyConnection(api, connection);
          api.webSockets.logLine(api, {label: "disconnect @ webSocket"}, connection);
        });
      });

      api.webSockets.io = io;
      api.log("webSockets bound to " + api.configData.httpServer.port, "green");
      next();
    }

    api.webSockets.handleActionResponse = function(proxy_connection, cont){
      var connection = proxy_connection._original_connection;
      connection.response = proxy_connection.response;
      connection.error = proxy_connection.error;
      var delta = new Date().getTime() - connection.actionStartTime;          
      api.webSockets.respondToWebSocketClient(connection, cont, proxy_connection.respondingTo);
      api.webSockets.logLine(api, {label: "action @ webSocket", params: JSON.stringify(proxy_connection.params), action: proxy_connection.action, duration: delta}, connection);
    }

    api.webSockets.logLine = function(api, data, connection, color){
      if(api.configData.log.logRequests){
        if(data.to == null){ data.to = connection.remoteIP; }
        if(api.configData.log.logRequests){
          api.logJSON(data ,color);
        }
      }
    }

    api.webSockets.respondToWebSocketClient = function(connection, cont, respondingTo){
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
        connection.emit(connection.response.context, connection.response);
      }
    }

    api.webSockets.disconnectAll = function(api, next){
      for( var i in api.connections ){
        if(api.connections[i].type == "webSocket"){
          api.connections[i].disconnect();
          delete api.connections[i];
        }
      }
      if(typeof next == "function"){ next(); }
    }

    api.webSockets._teardown = function(api, next){
      api.webSockets.disconnectAll(api, function(){
        api.webServer.server.close();
        next();
      });
    }

    next();
    
  }
}

/////////////////////////////////////////////////////////////////////
// exports
exports.initWebSockets = initWebSockets;