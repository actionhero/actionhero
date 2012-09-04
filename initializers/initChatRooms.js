var initChatRooms = function(api, next){

	api.chatRoom = {};

	if(api.redis.enable === false){
		api.chatRoom.rooms = {};
	}else{
		api.chatRoom.redisRoomPrefix = "actionHero:roomMembers::";
	}

	////////////////////////////////////////////////////////////////////////////
	// broadcast a message to all connections in a room
	api.chatRoom.socketRoomBroadcast = function(api, connection, message, fromQueue){
		if(fromQueue == null){fromQueue = false;}
		if(api.redis.enable === true && fromQueue == false){ 
			var payload = {
				message: message,
				connection: {
					room: connection.room,
					public: {
						id: connection.public.id
					}
				}
			};
			api.redis.client.publish("actionHero:say", JSON.stringify(payload));
		}
		else{
			if(connection == null){
				connection = {room: api.configData.general.defaultChatRoom, public: {id: 0}}
				var messagePayload = {message: message, from: api.configData.general.serverName, context: "user"};
			}else{
				var messagePayload = {message: message, from: connection.public.id, context: "user"};
			}
			// TCP clients
			if(api.socketServer != null){
				for(var i in api.socketServer.connections){
					var thisConnection = api.socketServer.connections[i];
					if(thisConnection.room == connection.room){
						if(connection == null || thisConnection.public.id != connection.public.id){
							api.socketServer.sendSocketMessage(thisConnection, messagePayload);
						}
					}
				}
			}
			// WebSocket clients
			if(api.webSockets != null){
				for(var i in api.webSockets.connections){
					var thisConnection = api.webSockets.connections[i];
					if(thisConnection.room == connection.room){
						if(connection == null || thisConnection.public.id != connection.public.id){
							thisConnection.emit("say", messagePayload);
						}
					}
				}
			}
		}
	}
	
	////////////////////////////////////////////////////////////////////////////
	// status for a room
	api.chatRoom.socketRoomStatus = function(api, room, next){
		if(api.redis.enable === true){
			var key = api.chatRoom.redisRoomPrefix + room;
			api.redis.client.llen(key, function(err, length){
				api.redis.client.lrange(key, 0, length, function(err, members){
					next({
						members: members,
						membersCount: length
					});
				});
			});
		}else{
			if(api.chatRoom.rooms[room] != null){
				next({
					members: api.chatRoom.rooms[room],
					membersCount: api.chatRoom.rooms[room].length
				});
			}else{
				next({
					members: null,
					membersCount: 0
				});
			}
		}
	}

	api.chatRoom.roomAddMember = function(api, connection, next){
		api.chatRoom.announceMember(api, connection, true);
		var room = connection.room;
		var name = connection.public.id;
		if(api.redis.enable === true){
			var key = api.chatRoom.redisRoomPrefix + connection.room;
			api.redis.client.rpush(key, name, function(){
				if(typeof next == "function"){ next(true) }
			});
		}else{
			if(api.chatRoom.rooms[room] == null){
				api.chatRoom.rooms[room] = [];
			}
			api.chatRoom.rooms[room].push(name);
			if(typeof next == "function"){ next(true) }
		}
	}

	api.chatRoom.roomRemoveMember = function(api, connection, next){
		api.chatRoom.announceMember(api, connection, false);
		var room = connection.room;
		var name = connection.public.id;
		if(api.redis.enable === true){
			var key = api.chatRoom.redisRoomPrefix + connection.room;
			api.redis.client.lrem(key, 1, name, function(){
				if(typeof next == "function"){ next(true) }
			});
		}else{
			for(var i in api.chatRoom.rooms){
				if(i == room){
					var rList = api.chatRoom.rooms[i];
					for(var j in rList){
						if(rList[j] == name){
							rList.splice(j,1);
							break;
						}
					}
					break;
				}
			}
			if(typeof next == "function"){ next(true) }
		}
	}

	api.chatRoom.announceMember = function(api, connection, direction){
		// var message = connection.public.id;
		var message = "I";
		if(direction == true){
			message += " have entered the room";
		}else{
			message += " have left the room";
		}
		api.chatRoom.socketRoomBroadcast(api, connection, message);
	}

	////////////////////////////////////////////////////////////////////////////
	// register for messages
	if(api.redis.enable === true){
		api.redis.registerChannel(api, "actionHero:say", function(channel, message){
			message = JSON.parse(message);
			api.chatRoom.socketRoomBroadcast(api, message.connection, message.message, true);
		});
	}

	next();
}

/////////////////////////////////////////////////////////////////////
// exports
exports.initChatRooms = initChatRooms;