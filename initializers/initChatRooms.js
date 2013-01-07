var initChatRooms = function(api, next){

  api.chatRoom = {};

  if(api.redis.enable === false){
    api.chatRoom.rooms = {};
  }else{
    api.chatRoom.redisRoomPrefix = "actionHero:roomMembers:";
    api.chatRoom.chatChannel = "actionHero:say:" + api.configData.redis.DB;
  }

  ////////////////////////////////////////////////////////////////////////////
  // broadcast a message to all connections in a room
  api.chatRoom.socketRoomBroadcast = function(api, connection, message, fromQueue){
    if(fromQueue == null){fromQueue = false;}
    if(connection == null){ connection = {}; }
    if(connection.room == null){ connection.room = api.configData.general.defaultChatRoom; }
    if(connection.public == null){ connection.public = {}; }
    if(connection.public.id == null){ connection.public.id = 0; }
    if(connection.params != null && connection.params.roomMatchKey != null){ connection.roomMatchKey = connection.params.roomMatchKey; }
    if(connection.params != null && connection.params.roomMatchValue != null){ connection.roomMatchValue = connection.params.roomMatchValue; }
    if(api.redis.enable === true && fromQueue == false){ 
      var payload = {
        message: message,
        connection: {
          room: connection.room,
          roomMatchKey: connection.roomMatchKey,
          roomMatchValue: connection.roomMatchValue,
          public: {
            id: connection.public.id
          }
        }
      };
      api.redis.client.publish(api.chatRoom.chatChannel, JSON.stringify(payload));
    }
    else{
      api.stats.increment(api, "chatRooom:messagesSent");
      var messagePayload = {message: message, room: connection.room, from: connection.public.id, context: "user", sentAt: new Date().getTime() };
      for(var i in api.connections){
        var thisConnection = api.connections[i];
        if(thisConnection.room == connection.room || thisConnection.additionalListeningRooms.indexOf(connection.room) > -1){
          if(connection == null || thisConnection.public.id != connection.public.id){
            var matched = false;
            if(connection.roomMatchKey == null){
              matched = true;
            }else if(thisConnection[connection.roomMatchKey] == connection.roomMatchValue){
                matched = true;
            }
            if(matched == true){
              if(thisConnection.type == "web"){ api.webServer.storeWebChatMessage(api, thisConnection, messagePayload); }
              else if(thisConnection.type == "socket"){ api.socketServer.sendSocketMessage(thisConnection, messagePayload); }
              else if(thisConnection.type == "webSocket"){ thisConnection.emit("say", messagePayload); }
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
      api.redis.client.lrange(key, 0, -1, function(err, members){
        next(null, {
          room: room,
          members: members,
          membersCount: members.length
        });
      });
    }else{
      if(api.chatRoom.rooms[room] != null){
        next(null, {
          room: room,
          members: api.chatRoom.rooms[room],
          membersCount: api.chatRoom.rooms[room].length
        });
      }else{
        next(null, {
          room: room,
          members: null,
          membersCount: 0
        });
      }
    }
  }

  api.chatRoom.roomAddMember = function(api, connection, next){
    var room = connection.room;
    var name = connection.public.id;
    api.chatRoom.socketRoomStatus(api, room, function(err, roomStatus){
      var found = false
      for(var i in roomStatus.members){
        if (name == roomStatus.members[i]){ found = true; break; }
      }
      if(found == false){
        api.stats.increment(api, "chatRooom:roomMembers:" + connection.room);
        api.chatRoom.announceMember(api, connection, true);
        if(api.redis.enable === true){
          var key = api.chatRoom.redisRoomPrefix + connection.room;
          api.redis.client.rpush(key, name, function(){
            if(typeof next == "function"){ next(null, true) }
          });
        }else{
          if(api.chatRoom.rooms[room] == null){
            api.chatRoom.rooms[room] = [];
          }
          api.chatRoom.rooms[room].push(name);
          if(typeof next == "function"){ next(null, true) }
        }
      }else{
        if(typeof next == "function"){ next(new Error("Connection already in this room"), false) }
      }
    });
  }

  api.chatRoom.roomRemoveMember = function(api, connection, next){
    var room = connection.room;
    var name = connection.public.id;
    api.stats.increment(api, "chatRooom:roomMembers:" + connection.room, -1);
    if(api.redis.enable === true){
      var key = api.chatRoom.redisRoomPrefix + connection.room;
      api.redis.client.lrem(key, 1, name, function(){
        api.chatRoom.announceMember(api, connection, false);
        if(typeof next == "function"){ next(null, true) }
      });
    }else{
      for(var i in api.chatRoom.rooms){
        if(i == room){
          var rList = api.chatRoom.rooms[i];
          for(var j in rList){
            if(rList[j] == name){
              rList.splice(j,1);
              api.chatRoom.announceMember(api, connection, false);
              break;
            }
          }
          break;
        }
      }
      if(typeof next == "function"){ next(null, true) }
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
    api.redis.registerChannel(api, api.chatRoom.chatChannel, function(channel, message){
      message = JSON.parse(message);
      api.chatRoom.socketRoomBroadcast(api, message.connection, message.message, true);
    });
  }

  next();
}

/////////////////////////////////////////////////////////////////////
// exports
exports.initChatRooms = initChatRooms;