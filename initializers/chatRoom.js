var chatRoom = function(api, next){

  api.chatRoom = {};
  api.chatRoom.keys = {
    rooms:   'actionhero:chatRoom:rooms',
    members: 'actionhero:chatRoom:members:',
    auth:    'actionhero:chatRoom:auth'
  }
  api.chatRoom.messageChannel     = '/actionhero/chat/chat';
  api.chatRoom.rebroadcastChannel = '/actionhero/chat/rebroadcast';

  api.chatRoom._start = function(api, next){
    api.chatRoom.messageSubscription = api.faye.client.subscribe(api.chatRoom.messageChannel, function(message){
      api.chatRoom.incomingMessage(message);
    });

    api.chatRoom.rebroadcastSubscription = api.faye.client.subscribe(api.chatRoom.rebroadcastChannel, function(message){
      api.chatRoom.incomingRebroadcast(message);
    });

    if(api.config.general.startingChatRooms != null){
      for(var room in api.config.general.startingChatRooms){
        api.log('ensuring the existence of the chatRoom: ' + room);
        api.chatRoom.add(room, function(err){
          if(err != null){ api.log(err, 'crit') }
          if(api.config.general.startingChatRooms[room] != null){
            for(var authKey in api.config.general.startingChatRooms[room]){
              var authValue = api.config.general.startingChatRooms[room][authKey];
              api.chatRoom.setAuthenticationPattern(room, authKey, authValue);
            }
          }
        });
      }
    }
    next();
  }

  api.chatRoom._stop = function(api, next){
    api.chatRoom.messageSubscription.cancel();
    api.chatRoom.rebroadcastSubscription.cancel();
    next();
  }

  api.chatRoom.broadcast = function(connection, room, message, callback){
    if(room == null || room.length == 0 || message == null || message.length == 0){
      if(typeof callback == 'function'){ process.nextTick(function(){ callback('both room and message are required'); }) }
    }else if(connection.rooms.indexOf(room) > -1){
      if(connection.id == null){ connection.id = 0 }
      api.stats.increment('chatRoom:messagesSent');
      api.stats.increment('chatRoom:messagesSent:' + room);
      var payload = {
        serverToken: api.config.general.serverToken,
        serverId: api.id,
        message: message,
        sentAt: new Date().getTime(),
        connection: {
          id: connection.id,
          room: room
        }
      };
      api.faye.client.publish(api.chatRoom.messageChannel, payload);
      if(typeof callback == 'function'){ process.nextTick(function(){ callback(null); }) }
    } else {
      if(typeof callback == 'function'){ process.nextTick(function(){ callback('connection not in this room'); }) }
    }
  }

  api.chatRoom.incomingMessage = function(message){
    api.stats.increment('chatRoom:messagesReceived');
    var messagePayload = {message: message.message, room: message.connection.room, from: message.connection.id, context: 'user', sentAt: message.sentAt };
    for(var i in api.connections.connections){
      var thisConnection = api.connections.connections[i];
      if(thisConnection.canChat === true){
        if(thisConnection.rooms.indexOf(message.connection.room) > -1){
          if(message.connection == null || thisConnection.id != message.connection.id){
            thisConnection.sendMessage(messagePayload, 'say');
          }
        }
      }
    }
  }

  api.chatRoom.incomingRebroadcast = function(message){
    if(message.connectionId != null && api.connections.connections[message.connectionId] != null){
      if(message.action === 'addMember')     { api.chatRoom.addMember(message.connectionId, message.room);    }
      if(message.action === 'removeMember')  { api.chatRoom.removeMember(message.connectionId, message.room); }
      if(message.action === 'reAuthenticate'){ api.chatRoom.reAuthenticate(message.connectionId);             }
    }else if(message.connectionId == null){
      // reAuthenticate
    }else{
      // nothing to do, I don't manage this connection
    }
    
  }

  api.chatRoom.add = function(room, callback){
    api.redis.client.sadd(api.chatRoom.keys.rooms, room, function(err, count){
      if(typeof callback == 'function'){ process.nextTick(function(){ callback(err, count); }) }
    });
  }

  api.chatRoom.del = function(room, callback){
    api.chatRoom.broadcast({room: room}, 'this room has been deleted');
    api.redis.client.srem(api.chatRoom.keys.rooms, room, function(err){
      api.redis.client.hgetall(api.chatRoom.keys.members + room, function(err, membersHash){
        for(var id in membersHash){
          api.chatRoom.removeMember(id, room);
        }
      });
      api.redis.client.del(api.chatRoom.keys.members + room, function(err){
        api.chatRoom.setAuthenticationPattern(room, null, null, function(){
          if(typeof callback == 'function'){ callback() }
        });
      });
    });
  }

  api.chatRoom.exists = function(room, callback){
    api.redis.client.sismember(api.chatRoom.keys.rooms, room, function(err, bool){
      var found = false;
      if(bool === 1 || bool === true){
        found = true;
      }
      if(typeof callback == 'function'){ callback(err, found) }
    });
  }
  
  api.chatRoom.setAuthenticationPattern = function(room, key, value, callback){
    if(key == null){
      api.redis.client.hdel(api.chatRoom.keys.auth, room, function(err){
        if(typeof callback == 'function'){ callback(err) }
      });
    } else {
      var data = {}
      data[key] = value;
      api.redis.client.hset(api.chatRoom.keys.auth, room, JSON.stringify(data), function(err){
        api.redis.client.hgetall(key, function(err, members){
          members.forEach(function(member){
            api.chatRoom.reAuthenticate(member);
          });
          if(typeof callback == 'function'){ callback(err) }
        });        
      });
    }
  }

  api.chatRoom.roomStatus = function(room, callback){
    if(room != null){
      var key = api.chatRoom.keys.members + room;
      api.redis.client.hgetall(key, function(err, members){
        var cleanedMembers = {};
        var count = 0;
        for(var id in members){
          var data = JSON.parse(members[id])
          cleanedMembers[id] = {
            id: id,
            joinedAt: data['joinedAt']
          }
          count++;
        }
        callback(null, {
          room: room,
          members: cleanedMembers,
          membersCount: count
        });
      });
    } else {
      callback('room is required', null);
    }
  }

  api.chatRoom.authorize = function(connection, room, callback){
    api.redis.client.hget(api.chatRoom.keys.auth, room, function(err, rawAuth){
      var auth = {};
      if(rawAuth != null){ auth = JSON.parse(rawAuth) }
      var authorized = true;
      for(var k in auth){
        if(connection[k] == null || connection[k] != auth[k]){
          authorized = false;
        }
      }
      callback(err, authorized);
    });
  }

  api.chatRoom.reAuthenticate = function(connectionId, callback){
    if(api.connections.connections[connectionId] != null){
      var connection = api.connections.connections[connectionId];
      if(connection.rooms.length === 0){
        if(typeof callback == 'function'){ callback([]); }
      }else{
        var started   = 0;
        var failed    = [];
        var succeeded = [];
        connection.rooms.forEach(function(room){
          started++;
          (function(room){
            api.chatRoom.authorize(connection, room, function(err, authorized){
              started--;
              if(authorized === true) { succeeded.push(room); }
              if(authorized === false){ failed.push(room); }
              if(started === 0){
                failed.forEach(function(room){
                  api.chatRoom.removeMember(connection, room);
                })
                if(typeof callback == 'function'){ callback(failed); }
              }
            });
          })(room)
        });
      }
    }else{
      api.faye.client.publish(api.chatRoom.rebroadcastChannel, {
        serverId:        api.id,
        serverToken:     api.config.general.serverToken,
        action:          'reAuthenticate',
        connectionId:    connectionId
      });
    }
  }

  api.chatRoom.addMember = function(connectionId, room, callback){
    if(api.connections.connections[connectionId] != null){
      var connection = api.connections.connections[connectionId];
      if(connection.rooms.indexOf(room) < 0){
        api.chatRoom.exists(room, function(err, found){
          if(found === true){
            api.chatRoom.authorize(connection, room, function(err, authorized){
              if(authorized === true){
                api.redis.client.hget(api.chatRoom.keys.members + room, connection.id, function(err, memberDetails){
                  if(memberDetails == null){
                    memberDetails = {
                      id:       connection.id,
                      joinedAt: new Date().getTime(),
                      host:     api.id
                    };
                    api.redis.client.hset(api.chatRoom.keys.members + room, connection.id, JSON.stringify(memberDetails), function(err){
                      connection.rooms.push(room);
                      api.stats.increment('chatRoom:roomMembers:' + room);
                      api.chatRoom.announceMember(connection, room, true);
                      if(typeof callback == 'function'){ callback(null, true) }
                    });
                  } else {
                    if(typeof callback == 'function'){ callback('connection already in this room', false) }
                  }
                });
              } else {
                if(typeof callback == 'function'){ callback('not authorized to join room', false) }
              }
            });
          } else {
            if(typeof callback == 'function'){ callback('room does not exist', false) }
          }
        });
      }else{
        if(typeof callback == 'function'){ callback('already a member of room ' + room, false) }
      }
    }else{
      api.faye.client.publish(api.chatRoom.rebroadcastChannel, {
        serverId:        api.id,
        serverToken:     api.config.general.serverToken,
        action:          'addMember',
        connectionId:    connectionId,
        room:            room
      });
    }
  }

  api.chatRoom.removeMember = function(connectionId, room, callback){
    if(api.connections.connections[connectionId] != null){
      var connection = api.connections.connections[connectionId];
      if(connection.rooms.indexOf(room) > -1){
        api.chatRoom.exists(room, function(err, found){
          if(found){
            api.stats.increment('chatRoom:roomMembers:' + room, -1);
            api.redis.client.hdel(api.chatRoom.keys.members + room, connection.id, function(err){
              api.chatRoom.announceMember(connection, room, false);
              var index = connection.rooms.indexOf(room);
              if(index > -1){ connection.rooms.splice(index, 1); }
              if(typeof callback == 'function'){ callback(null, true) }
            });
          }else{
            if(typeof callback == 'function'){ callback('room does not exist', false) }
          }
        });
      } else {
        if(typeof callback == 'function'){ callback('not a member of room ' + room, false) }
      }
    }else{
      api.faye.client.publish(api.chatRoom.rebroadcastChannel, {
        serverId:        api.id,
        serverToken:     api.config.general.serverToken,
        action:          'removeMember',
        connectionId:    connectionId,
        room:            room
      });
    }
  }

  api.chatRoom.announceMember = function(connection, room, direction){
    var message = 'I';
    if(direction == true){
      message += ' have entered the room';
    } else {
      message += ' have left the room';
    }

    api.chatRoom.broadcast(connection, room, message);
  }

  next();
}

/////////////////////////////////////////////////////////////////////
// exports
exports.chatRoom = chatRoom;
