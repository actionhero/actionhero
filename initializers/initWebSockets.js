////////////////////////////////////////////////////////////////////////////
// Web Sockets via Socket.IO

var initWebSockets = function(api, next){

	if(api.configData.webSockets.enable != true){
		next()
	}else{
		api.webSockets = {};

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

		if(typeof api.configData.webSockets.settings == "Array" && api.configData.webSockets.settings.length > 0){
			for (var i in api.configData.webSockets.settings){
				io.enable(api.configData.webSockets.settings[i]); 
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
			api.stats.increment(api, "numberOfWebSocketRequests");
			api.stats.increment(api, "numberOfActiveWebSocketClients");
			api.socketServer.numberOfLocalWebSocketRequests++;

			api.utils.setupConnection(api, connection, "webSocket", connection.handshake.address.port, connection.handshake.address.address);
			
			if(api.configData.log.logRequests){
				api.logJSON({
					label: "connect @ webSocket",
					to: connection.remoteIP,
				});
			}

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
					if(api.configData.log.logRequests){
						api.logJSON({
							label: "roomView @ webSocket",
							to: connection.remoteIP,
							params: JSON.stringify(data),
						}, "grey");
					}
				});
			});

			connection.on('roomChange', function(data){
				if(data == null){ data = {}; }
				api.chatRoom.roomRemoveMember(api, connection, function(err, wasRemoved){
					connection.room = data.room;
					api.chatRoom.roomAddMember(api, connection);
					connection.messageCount++; 
					connection.emit("response", {context: "response", status: "OK", room: connection.room, messageCount: connection.messageCount});
					if(api.configData.log.logRequests){
						api.logJSON({
							label: "roomChange @ webSocket",
							to: connection.remoteIP,
							params: JSON.stringify(data),
						}, "grey");
					}
				});
			});

			connection.on('say', function(data){
				if(data == null){ data = {}; }
				var message = data.message;
				api.chatRoom.socketRoomBroadcast(api, connection, message);
				connection.messageCount++; 
				connection.emit("response", {context: "response", status: "OK", messageCount: connection.messageCount});
				if(api.configData.log.logRequests){
					api.logJSON({
						label: "say @ webSocket",
						to: connection.remoteIP,
						params: JSON.stringify(data),
					}, "grey");
				}
			}); 

			connection.on('detailsView', function(data){
				if(data == null){ data = {}; }
				var details = {};
				details.params = connection.params;
				details.public = connection.public;
				details.room = connection.room;
				connection.messageCount++; 
				connection.emit("response", {context: "response", status: "OK", details: details, messageCount: connection.messageCount});
				if(api.configData.log.logRequests){
					api.logJSON({
						label: "detailsView @ webSocket",
						to: connection.remoteIP,
						params: JSON.stringify(data),
					}, "grey");
				}
			});

			connection.on('action', function(data){
				if(data == null){ data = {}; }
				connection.params = data;
				connection.error = null;
				connection.actionStartTime = new Date().getTime();
				connection.response = {};
				connection.response.context = "response";

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

				api.processAction(api, proxy_connection, proxy_connection.messageCount, function(proxy_connection, cont){
					connection = proxy_connection._original_connection;
					connection.response = proxy_connection.response;
					connection.error = proxy_connection.error;
					var delta = new Date().getTime() - connection.actionStartTime;
					if(api.configData.log.logRequests){
						api.logJSON({
							label: "action @ webSocket",
							to: connection.remoteIP,
							action: proxy_connection.action,
							params: JSON.stringify(data),
							duration: delta,
						});
					}
					connection.messageCount++; 
					api.webSockets.respondToWebSocketClient(connection, cont);
				});
			});

			connection.on('disconnect', function(){
				api.stats.increment(api, "numberOfActiveWebSocketClients", -1);
				api.utils.destroyConnection(api, connection);
				if(api.configData.log.logRequests){
					api.logJSON({
						label: "disconnect @ webSocket",
						to: connection.remoteIP,
					});
				}
			});
		});

		api.webSockets.respondToWebSocketClient = function(connection, cont){
			if(cont != false){
				if(connection.response.context == "response"){
					connection.response.messageCount = connection.messageCount;
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

		api.webSockets.io = io;
		api.log("webSockets bound to " + api.configData.httpServer.port, "green");
		next();
	}
}

/////////////////////////////////////////////////////////////////////
// exports
exports.initWebSockets = initWebSockets;