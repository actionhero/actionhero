var chatRooms = function(api, next){

  api.chatRoom = {};
  api.chatRoom.enabled = api.configData.general.chatEnabled !== false;
  api.chatRoom.redisDataPrefix = "actionHero:roomMembers:";
  api.chatRoom.fayeChannel = "/actionHero/chat";

  ////////////////////////////////////////////////////////////////////////////
  // broadcast a message to all connections in a room
  api.chatRoom.socketRoomBroadcast = function(connection, message){
    if(!api.chatRoom.enabled){
      return;
    }
    if(connection == null){ connection = {}; }
    if(connection.room == null){ connection.room = api.configData.general.defaultChatRoom; }
    if(connection.id == null){ connection.id = 0; }
    if(connection.params != null && connection.params.roomMatchKey != null){ connection.roomMatchKey = connection.params.roomMatchKey; }
    if(connection.params != null && connection.params.roomMatchValue != null){ connection.roomMatchValue = connection.params.roomMatchValue; }
    api.stats.increment("chatRoom:messagesSent");
    var payload = {
      serverToken: api.configData.general.serverToken,
      serverId: api.id,
      message: message,
      sentAt: new Date().getTime(),
      connection: {
        id: connection.id,
        room: connection.room,
        roomMatchKey: connection.roomMatchKey,
        roomMatchValue: connection.roomMatchValue
      }
    }
    api.faye.client.publish(api.chatRoom.fayeChannel, payload);
  };

  api.chatRoom.incommingMessage = function(message){
    if(!api.chatRoom.enabled){
      return;
    }else if(message.serverToken != api.configData.general.serverToken){
      api.log("message token miss-match from " + message.serverId, "error", message);
    }else{
      api.stats.increment("chatRoom:messagesRecieved");
      var messagePayload = {message: message.message, room: message.connection.room, from: message.connection.id, context: "user", sentAt: message.sentAt };
      for(var i in api.connections.connections){
        var thisConnection = api.connections.connections[i];
        if(thisConnection.room == message.connection.room || thisConnection.additionalListeningRooms.indexOf(message.connection.room) > -1){
          if(message.connection == null || thisConnection.id != message.connection.id){
            var matched = false;
            if(message.connection.roomMatchKey == null){
              matched = true;
            }else if(thisConnection[message.connection.roomMatchKey] == message.connection.roomMatchValue){
                matched = true;
            }
            if(matched == true){
              thisConnection.sendMessage(messagePayload, 'say');
            }
          }
        }
      }
    }
  }
  
  ////////////////////////////////////////////////////////////////////////////
  // status for a room
  api.chatRoom.socketRoomStatus = function(room, next){
    if(!api.chatRoom.enabled){
      next(null, {enabled: false});
    }else{
      var key = api.chatRoom.redisDataPrefix + room;
      api.redis.client.lrange(key, 0, -1, function(err, members){
        next(null, {
          room: room,
          members: members,
          membersCount: members.length
        });
      });
    }
  }

  api.chatRoom.roomAddMember = function(connection, next){
    if(!api.chatRoom.enabled){
      if(typeof next == "function"){ next(null, true) }
    }else{
      var room = connection.room;
      var name = connection.id;
      api.chatRoom.socketRoomStatus(room, function(err, roomStatus){
        var found = false
        for(var i in roomStatus.members){
          if (name == roomStatus.members[i]){ found = true; break; }
        }
        if(found == false){
          api.stats.increment("chatRoom:roomMembers:" + connection.room);
          api.chatRoom.announceMember(connection, true);
          var key = api.chatRoom.redisDataPrefix + connection.room;
          api.redis.client.rpush(key, name, function(){
            if(typeof next == "function"){ next(null, true) }
          });
        }else{
          if(typeof next == "function"){ next(new Error("Connection already in this room"), false) }
        }
      });
    }
  }

  api.chatRoom.roomRemoveMember = function(connection, next){
    if(!api.chatRoom.enabled){
      if(typeof next == "function"){ next(null, true) }
    }else{
      var room = connection.room;
      var name = connection.id;
      api.stats.increment("chatRoom:roomMembers:" + connection.room, -1);
      var key = api.chatRoom.redisDataPrefix + connection.room;
      api.redis.client.llen(key, function(err, length){
        if(length > 0){
          api.redis.client.lrem(key, 1, name, function(){
            api.chatRoom.announceMember(connection, false);
            if(typeof next == "function"){ next(null, true) }
          });
        }else{
          if(typeof next == "function"){ next(null, true) }
        }
      });
    }
  }

  api.chatRoom.announceMember = function(connection, direction){
    if(api.chatRoom.enabled){
      var message = "I";
      if(direction == true){
        message += " have entered the room";
      }else{
        message += " have left the room";
      }
      api.chatRoom.socketRoomBroadcast(connection, message);
    }
  }

  api.chatRoom._start = function(api, next){
    api.chatRoom.enabled = api.configData.general.chatEnabled !== false;
    if(api.chatRoom.enabled){
      api.chatRoom.subscription = api.faye.client.subscribe(api.chatRoom.fayeChannel, function(message) {
        api.chatRoom.incommingMessage(message);
      });
    }
    next();
  } 

  api.chatRoom._teardown = function(api, next){
    if(api.chatRoom.subscription){
      api.chatRoom.subscription.cancel();
    }
    next();
  } 

  next();
}

/////////////////////////////////////////////////////////////////////
// exports
exports.chatRooms = chatRooms;
