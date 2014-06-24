var async = require('async');

var chatRoom = function(api, next){

  api.chatRoom = {};
  api.chatRoom.keys = {
    rooms:   'actionhero:chatRoom:rooms',
    members: 'actionhero:chatRoom:members:',
    auth:    'actionhero:chatRoom:auth'
  }
  api.chatRoom.messageChannel     = '/actionhero/chat/chat';
  api.chatRoom.joinCallbacks      = {};
  api.chatRoom.leaveCallbacks     = {};

  api.chatRoom._start = function(api, next){
    api.redis.subsciptionHandlers['chat'] = function(message){
      if(api.chatRoom != null){
        api.chatRoom.incomingMessage(message);
      }
    }

    if(api.config.general.startingChatRooms != null){
      for(var room in api.config.general.startingChatRooms){
        api.log('ensuring the existence of the chatRoom: ' + room);
        api.chatRoom.add(room, function(err){
          // if(err != null){ api.log(err, 'crit') }
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
    next();
  }

  api.chatRoom.addJoinCallback = function(func, priority){
    if(!priority) priority = api.config.general.defaultMiddlewarePriority;
    priority = Number(priority); // ensure priority is numeric
    if(!api.chatRoom.joinCallbacks[priority]) api.chatRoom.joinCallbacks[priority] = [];
    return api.chatRoom.joinCallbacks[priority].push(func);
  }

  api.chatRoom.addLeaveCallback = function(func, priority){
    if(!priority) priority = api.config.general.defaultMiddlewarePriority;
    priority = Number(priority); // ensure priority is numeric
    if(!api.chatRoom.leaveCallbacks[priority]) api.chatRoom.leaveCallbacks[priority] = [];
    return api.chatRoom.leaveCallbacks[priority].push(func);
  }

  api.chatRoom.broadcast = function(connection, room, message, callback){
    if(room == null || room.length == 0 || message == null || message.length == 0){
      if(typeof callback == 'function'){ process.nextTick(function(){ callback( api.config.errors.connectionRoomAndMessage() ); }) }
    }else if(connection.rooms == null || connection.rooms.indexOf(room) > -1){
      if(connection.id == null){ connection.id = 0 }
      api.stats.increment('chatRoom:messagesSent');
      api.stats.increment('chatRoom:messagesSent:' + room);
      var payload = {
        messageType: 'chat',
        serverToken: api.config.general.serverToken,
        serverId: api.id,
        message: message,
        sentAt: new Date().getTime(),
        connection: {
          id: connection.id,
          room: room
        }
      };
      api.redis.publish(payload);
      if(typeof callback == 'function'){ process.nextTick(function(){ callback(null); }) }
    } else {
      if(typeof callback == 'function'){ process.nextTick(function(){ callback( api.config.errors.connectionNotInRoom(room) ); }) }
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

  api.chatRoom.add = function(room, callback){
    api.chatRoom.exists(room, function(err, found){
      if(found === false){
        api.redis.client.sadd(api.chatRoom.keys.rooms, room, function(err, count){
          if(typeof callback === 'function'){ callback(err, count); }
        });
      } else {
        if(typeof callback === 'function'){ callback( api.config.errors.connectionRoomExists(room), null) }
      }
    });
  }

  api.chatRoom.destroy = function(room, callback){
    api.chatRoom.exists(room, function(err, found){
      if(found === true){
        api.chatRoom.broadcast({}, room, api.config.errors.connectionRoomHasBeenDeleted(room), function(){
          api.redis.client.hgetall(api.chatRoom.keys.members + room, function(err, membersHash){
            var closers = [];

            for(var id in membersHash){
              closers.push(function(next){
                api.chatRoom.removeMember(id, room, function(){
                  next();
                });
              });
            }

            closers.push(function(){
              api.chatRoom.setAuthenticationPattern(room, null, null, function(){
                api.redis.client.srem(api.chatRoom.keys.rooms, room, function(err){
                  api.redis.client.del(api.chatRoom.keys.members + room, function(err){
                    if(typeof callback === 'function'){ callback() }
                  });
                });
              });
            });

            async.series(closers);
            
          });
        });
      } else {
        if(typeof callback === 'function'){ callback( api.config.errors.connectionRoomNotExist(room), null) }
      }
    });
  }

  api.chatRoom.exists = function(room, callback){
    api.redis.client.sismember(api.chatRoom.keys.rooms, room, function(err, bool){
      var found = false;
      if(bool === 1 || bool === true){
        found = true;
      }
      if(typeof callback === 'function'){ callback(err, found) }
    });
  }
  
  api.chatRoom.setAuthenticationPattern = function(room, key, value, callback){
    api.chatRoom.exists(room, function(err, found){
      if(found === true){
        if(key == null){
          api.redis.client.hdel(api.chatRoom.keys.auth, room, function(err){
            if(typeof callback === 'function'){ callback(err) }
          });
        } else {
          var data = {}
          data[key] = value;
          api.redis.client.hset(api.chatRoom.keys.auth, room, JSON.stringify(data), function(err){
            api.redis.client.hgetall((api.chatRoom.keys.members + room), function(err, members){
              if(api.utils.hashLength( members ) === 0){
                if(typeof callback === 'function'){ callback(err); }
              }else{
                var started = 0;
                if(err == null && members != null){
                  for(var member in members){
                    started++;
                    api.chatRoom.reAuthenticate(member, function(){
                      started--;
                      if(started === 0){
                        if(typeof callback === 'function'){ callback(err); }
                      }
                    });
                  }
                }
              }
            });        
          });
        }
      } else {
        if(typeof callback === 'function'){ callback( api.config.errors.connectionRoomNotExist(room), null) }
      }
    });
  }

  api.chatRoom.roomStatus = function(room, callback){
    if(room != null){
      api.chatRoom.exists(room, function(err, found){
        if(found === true){
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
          if(typeof callback === 'function'){ callback( api.config.errors.connectionRoomNotExist(room), null) }
        }
      });
    } else {
      if(typeof callback === 'function'){ callback( api.config.errors.connectionRoomRequired() , null); }
    }
  }

  api.chatRoom.authorize = function(connection, room, callback){
    api.chatRoom.exists(room, function(err, found){
      if(found === true){
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
      } else {
        if(typeof callback === 'function'){ callback( api.config.errors.connectionRoomNotExist(room), null) }
      }
    });
  }

  api.chatRoom.reAuthenticate = function(connectionId, callback){
    if(api.connections.connections[connectionId] != null){
      var connection = api.connections.connections[connectionId];
      if(connection.rooms.length === 0){
        if(typeof callback === 'function'){ callback([]); }
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
                if(failed.length === 0){
                  if(typeof callback === 'function'){ callback(failed); }
                }else{
                  failed.forEach(function(room){
                    started++;
                    api.chatRoom.removeMember(connectionId, room, function(){
                      started--;
                      if(started === 0){
                        if(typeof callback === 'function'){ callback(failed); }
                      }
                    });
                  });
                }
              }
            });
          })(room)
        });
      }
    }else{
      api.redis.doCluster('api.chatRoom.reAuthenticate', [connectionId], connectionId, callback);
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
                      api.chatRoom.handleCallbacks(connection, room, true);
                      if(typeof callback === 'function'){ callback(null, true); }
                    });
                  } else {
                    if(typeof callback === 'function'){ callback( api.config.errors.connectionAlreadyInRoom(room), false) }
                  }
                });
              } else {
                if(typeof callback === 'function'){ callback( api.config.errors.connectionNotAuthorized(room), false) }
              }
            });
          } else {
            if(typeof callback === 'function'){ callback( api.config.errors.connectionRoomNotExist(room), false) }
          }
        });
      }else{
        if(typeof callback === 'function'){ callback( api.config.errors.connectionAlreadyInRoom(room), false) }
      }
    }else{
      api.redis.doCluster('api.chatRoom.addMember', [connectionId, room], connectionId, callback);
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
              api.chatRoom.handleCallbacks(connection, room, false);
              var index = connection.rooms.indexOf(room);
              if(index > -1){ connection.rooms.splice(index, 1); }
              if(typeof callback === 'function'){ callback(null, true) }
            });
          }else{
            if(typeof callback === 'function'){ callback( api.config.errors.connectionRoomNotExist(room), false) }
          }
        });
      } else {
        if(typeof callback === 'function'){ callback( api.config.errors.connectionNotInRoom(room), false) }
      }
    }else{
      api.redis.doCluster('api.chatRoom.removeMember', [connectionId, room], connectionId, callback);
    }
  }

  api.chatRoom.handleCallbacks = function(connection, room, direction){
    if(direction == true){
      var collecton = api.chatRoom.joinCallbacks;
    } else {
      var collecton = api.chatRoom.leaveCallbacks;
    }
    
    var priorities = [];
    for(var c in collecton) priorities.push(c);
    priorities.forEach(function(priority){
      collecton[priority].forEach(function(c){
        c(connection, room);   
      });
    });
  }

  next();
}

/////////////////////////////////////////////////////////////////////
// exports
exports.chatRoom = chatRoom;
