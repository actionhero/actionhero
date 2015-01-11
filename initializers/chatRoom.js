var async = require('async');

module.exports = {
  startPriority: 200,
  loadPriority:  520,
  initialize: function(api, next){

    api.chatRoom = {};
    api.chatRoom.keys = {
      rooms:   'actionhero:chatRoom:rooms',
      members: 'actionhero:chatRoom:members:',
    }
    api.chatRoom.messageChannel     = '/actionhero/chat/chat';
    api.chatRoom.joinCallbacks      = {};
    api.chatRoom.leaveCallbacks     = {};
    api.chatRoom.sayCallbacks       = {};

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

    api.chatRoom.addSayCallback = function(func, priority){
      if(!priority) priority = api.config.general.defaultMiddlewarePriority;
      priority = Number(priority); // ensure priority is numeric
      if(!api.chatRoom.sayCallbacks[priority]) api.chatRoom.sayCallbacks[priority] = [];
      return api.chatRoom.sayCallbacks[priority].push(func);
    }

    api.chatRoom.broadcast = function(connection, room, message, callback){
      if(!room || room.length === 0 || message === null || message.length === 0){
        if(typeof callback === 'function'){ process.nextTick(function(){ callback( api.config.errors.connectionRoomAndMessage() ); }) }
      }else if(connection.rooms === undefined || connection.rooms.indexOf(room) > -1){
        if(connection.id === undefined){ connection.id = 0 }
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
        if(typeof callback === 'function'){ process.nextTick(function(){ callback(null); }) }
      } else {
        if(typeof callback === 'function'){ process.nextTick(function(){ callback( api.config.errors.connectionNotInRoom(room) ); }) }
      }
    }

    api.chatRoom.generateMessagePayload = function(message){
      return {
        message: message.message,
        room: message.connection.room,
        from: message.connection.id,
        context: 'user',
        sentAt: message.sentAt
      };
    }

    api.chatRoom.incomingMessage = function(message){
      api.stats.increment('chatRoom:messagesReceived');
      var messagePayload = api.chatRoom.generateMessagePayload(message);
      for(var i in api.connections.connections){
        var thisConnection = api.connections.connections[i];
        if(thisConnection.canChat === true){
          if(thisConnection.rooms.indexOf(messagePayload.room) > -1){
            if(message.connection === undefined || thisConnection.id !== messagePayload.from){
              api.chatRoom.handleCallbacks(thisConnection, messagePayload.room, 'say', messagePayload, function(err, newMessagePaylaod){
                if(!err){ thisConnection.sendMessage(newMessagePaylaod, 'say'); }
              });
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

              for(var id in membersHash){
                api.chatRoom.removeMember(id, room);
              }

              api.redis.client.srem(api.chatRoom.keys.rooms, room, function(){
                api.redis.client.del(api.chatRoom.keys.members + room, function(){
                  if(typeof callback === 'function'){ callback() }
                });
              });
              
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
    
    api.chatRoom.sanitizeMemberDetails = function(memberData){
    	return { id: memberData.id,
    	         joinedAt: memberData.joinedAt };
    }

    api.chatRoom.roomStatus = function(room, callback){
      if(room){
        api.chatRoom.exists(room, function(err, found){
          if(found === true){
            var key = api.chatRoom.keys.members + room;
            api.redis.client.hgetall(key, function(err, members){
              var cleanedMembers = {};
              var count = 0;
              for(var id in members){
                var data = JSON.parse(members[id])
                cleanedMembers[id] = api.chatRoom.sanitizeMemberDetails(data);
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
    
    api.chatRoom.generateMemberDetails = function(connection){
    	return { 
        id: connection.id,
        joinedAt: new Date().getTime(),
        host: api.id 
       };
    }

    api.chatRoom.addMember = function(connectionId, room, callback){
      if(api.connections.connections[connectionId]){
        var connection = api.connections.connections[connectionId];
        if(connection.rooms.indexOf(room) < 0){
          api.chatRoom.exists(room, function(err, found){
            if(found === true){
              api.chatRoom.handleCallbacks(connection, room, 'join', null, function(err){
                if(err){
                  callback(err, false);
                }else{
                  var memberDetails = api.chatRoom.generateMemberDetails( connection );
                  api.redis.client.hset(api.chatRoom.keys.members + room, connection.id, JSON.stringify(memberDetails), function(){
                    connection.rooms.push(room);
                    api.stats.increment('chatRoom:roomMembers:' + room);
                    if(typeof callback === 'function'){ callback(null, true); }
                  });
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
      if(api.connections.connections[connectionId]){
        var connection = api.connections.connections[connectionId];
        if(connection.rooms.indexOf(room) > -1){
          api.chatRoom.exists(room, function(err, found){
            if(found){
              api.chatRoom.handleCallbacks(connection, room, 'leave', null, function(err){
                if(err){
                  callback(err, false);
                }else{
                  api.stats.increment('chatRoom:roomMembers:' + room, -1);
                  api.redis.client.hdel(api.chatRoom.keys.members + room, connection.id, function(){
                    var index = connection.rooms.indexOf(room);
                    if(index > -1){ connection.rooms.splice(index, 1); }
                    if(typeof callback === 'function'){ callback(null, true) }
                  });
                }
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

    api.chatRoom.handleCallbacks = function(connection, room, direction, messagePayload, next){
      var collecton;
      var orderedCallbacks = [];
      var newMessagePaylaod = messagePayload;

      if(direction === 'join'){
        collecton = api.chatRoom.joinCallbacks;
      } else if(direction === 'leave' ) {
        collecton = api.chatRoom.leaveCallbacks;
      } else if(direction === 'say' ) {
        collecton = api.chatRoom.sayCallbacks;
      }
      
      var priorities = [];
      for(var c in collecton){ priorities.push(c); }
      priorities.forEach(function(priority){
        collecton[priority].forEach(function(c){
          if(messagePayload){
            orderedCallbacks.push( function(callback){
              c(connection, room, newMessagePaylaod, function(err, data){
                if(data){ newMessagePaylaod = data; }
                callback(err, data)
              });
            }); 
          }else{
            orderedCallbacks.push( function(callback){
              c(connection, room, callback);
            });
          }
        });
      });

      async.series(orderedCallbacks, function(err, data){
        
        while(data.length > 0){
          var thisData = data.shift();
          if(thisData){ newMessagePaylaod = thisData; }
        }
        next(err, newMessagePaylaod)
      });
    }

    next();
  },

  start: function(api, next){
    api.redis.subsciptionHandlers.chat = function(message){
      if(api.chatRoom){
        api.chatRoom.incomingMessage(message);
      }
    }

    if(api.config.general.startingChatRooms){
      for(var room in api.config.general.startingChatRooms){
        api.log('ensuring the existence of the chatRoom: ' + room);
        api.chatRoom.add(room);
      }
    }

    next();
  }

}