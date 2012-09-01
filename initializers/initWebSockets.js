////////////////////////////////////////////////////////////////////////////
// Web Sockets via Socket.IO

var initWebSockets = function(api, next)
{
	if(api.configData.webSockets.enable != true){
		next()
	}else{
		api.webSockets = {};
		api.webSockets.connections = [];
		var IOs = [];

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

		// TODO: Right now, redis doesn't like it if you have more than one bind (works ok if the store is local)...
		if(api.configData.webSockets.bind == "http"){
			var io_http = api.io.listen(api.webServer.webApp, { 'log level': 0 });
			IOs.push(io_http);
		}else if(api.configData.webSockets.bind == "https"){
			var io_https = api.io.listen(api.webServer.secureWebApp, { 'log level': 0 });
			IOs.push(io_https);
		}else{
			api.log(api.configData.webSockets.bind + " is not something that the webSockets can bind to, exiting.", ["red", "bold"]);
			process.exit();
		}

		for(var i in IOs){
			var io = IOs[i];

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
				var pub    = api.redisPackage.createClient(c.port, c.host, c.options);
				var sub    = api.redisPackage.createClient(c.port, c.host, c.options);
				var client = api.redisPackage.createClient(c.port, c.host, c.options);

				pub.on("error", function(msg){ logger.error(msg); })
				sub.on("error", function(msg){ logger.error(msg); })
				client.on("error", function(msg){ logger.error(msg); })

				if(c.password != null){ 
					pub.auth(c.password, function(){
						pub.select(c.DB, function(err,res){});
					}); 
					sub.auth(c.password, function(){
						sub.select(c.DB, function(err,res){});
					}); 
					client.auth(c.password, function(){
						client.select(c.DB, function(err,res){});
					}); 
				}else{
					pub.select(c.DB, function(err,res){});
					sub.select(c.DB, function(err,res){});
					client.select(c.DB, function(err,res){});
				}
			}

			if(c.enable == true){
				io.set('store', new RedisStore({
					redisPub : pub,
					redisSub : sub,
					redisClient : client
				}));
			}

			io.sockets.on('connection', function(connection){
				api.stats.incrament(api, "numberOfWebSocketRequests");
				api.socketServer.numberOfLocalWebSocketRequests++;
				// console.log(connection)

				connection.type = "webSocket";
				connection.params = {};
				connection.remoteIP = connection.handshake.address.address;
				connection.room = api.configData.defaultChatRoom;
				connection.messageCount = 0;
				connection.public = {};
				connection.public.id = connection.id;
				connection.public.connectedAt = new Date().getTime();
				api.chatRoom.roomAddMember(api, connection);

				api.stats.incrament(api, "numberOfActiveWebSocketClients");
		    	if(api.configData.log.logRequests){
					api.logJSON({
						label: "connect @ webSocket",
						to: connection.remoteIP,
					});
				}

		    	api.webSockets.connections.push(connection);

				var welcomeMessage = {welcome: api.configData.welcomeMessage, room: connection.room, context: "api"};
		    	connection.emit('welcome', welcomeMessage);

		    	connection.on('exit', function(data){ connection.disconnect(); });
		    	connection.on('quit', function(data){ connection.disconnect(); });
		    	connection.on('close', function(data){ connection.disconnect(); });
		    	
		    	connection.on('roomView', function(data){
		    		api.chatRoom.socketRoomStatus(api, connection.room, function(roomStatus){
						connection.emit("response", {context: "response", status: "OK", room: connection.room, roomStatus: roomStatus});
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
		    		api.chatRoom.roomRemoveMember(api, connection, function(){
						connection.room = data.room;
						api.chatRoom.roomAddMember(api, connection);
						connection.emit("response", {context: "response", status: "OK", room: connection.room});
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
		    		var message = data.message;
					api.chatRoom.socketRoomBroadcast(api, connection, message);
					connection.emit("response", {context: "response", status: "OK"});
					if(api.configData.log.logRequests){
						api.logJSON({
							label: "say @ webSocket",
							to: connection.remoteIP,
							params: JSON.stringify(data),
						}, "grey");
					}
		    	}); 
		    	connection.on('detailsView', function(data){
		    		details = {};
					details.params = connection.params;
					details.public = connection.public;
					connection.emit("response", {context: "response", status: "OK", details: details});
					if(api.configData.log.logRequests){
						api.logJSON({
							label: "detailsView @ webSocket",
							to: connection.remoteIP,
							params: JSON.stringify(data),
						}, "grey");
					}
		    	});

		    	connection.on('action', function(data){
		    		connection.params = data;
		    		connection.error = false;
					connection.actionStartTime = new Date().getTime();
					connection.response = {};
					connection.response.context = "response";
					api.processAction(api, connection, connection.messageCount, function(connection, cont){
						var delta = new Date().getTime() - connection.actionStartTime;
						if (connection.response.error == null){ connection.response.error = connection.error; }
						if(api.configData.log.logRequests){
							api.logJSON({
								label: "action @ webSocket",
								to: connection.remoteIP,
								action: connection.action,
								params: JSON.stringify(data),
								duration: delta,
							});
						}
						api.webSockets.respondToWebSocketClient(connection, cont);
					});
		    	});

				connection.on('disconnect', function(){
					api.log("webSocket connection "+connection.remoteIP+" | disconnected");
					api.stats.incrament(api, "numberOfActiveWebSocketClients", -1);
				});
			});
		}

		api.webSockets.respondToWebSocketClient = function(connection, cont){
			if(cont != false){
				if(connection.error == false){
					connection.response.error = connection.error;
					if(connection.response == {}){
						connection.response = {status: "OK"};
					}
					connection.emit(connection.response.context, connection.response);
				}else{
					if(connection.response.error == null){
						connection.response.error = connection.error;
					}
					connection.emit(connection.response.context, connection.response);
				}
			}
		}

		api.log("webSockets bound to " + api.configData.webSockets.bind, "green");
		next();
	}
}

/////////////////////////////////////////////////////////////////////
// exports
exports.initWebSockets = initWebSockets;