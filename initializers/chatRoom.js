'use strict';

var async = require('async');

module.exports = {
  startPriority: 200,
  loadPriority:  520,
  initialize: function(api, next){

    api.chatRoom = {};
    api.chatRoom.keys = {
      rooms:   'actionhero:chatRoom:rooms',
      members: 'actionhero:chatRoom:members:',
    };
    api.chatRoom.messageChannel     = '/actionhero/chat/chat';

    api.chatRoom.middleware = {};
    api.chatRoom.globalMiddleware = [];

    api.chatRoom.addMiddleware = function(data){
      if(!data.name){ throw new Error('middleware.name is required'); }
      if(!data.priority){ data.priority = api.config.general.defaultMiddlewarePriority; }
      data.priority = Number(data.priority);
      api.chatRoom.middleware[data.name] = data;

      api.chatRoom.globalMiddleware.push(data.name);
      api.chatRoom.globalMiddleware.sort(function(a, b){
        if(api.chatRoom.middleware[a].priority > api.chatRoom.middleware[b].priority){
          return 1;
        }else{
          return -1;
        }
      });
    };

    api.chatRoom.broadcast = function(connection, room, message, callback){
      if(!room || room.length === 0 || message === null || message.length === 0){
        if(typeof callback === 'function'){ process.nextTick(function(){ callback(api.config.errors.connectionRoomAndMessage(connection)); }); }
      }else if(connection.rooms === undefined || connection.rooms.indexOf(room) > -1){
        if(connection.id === undefined){ connection.id = 0; }
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
        var messagePayload = api.chatRoom.generateMessagePayload(payload);
        api.chatRoom.handleCallbacks(connection, messagePayload.room, 'onSayReceive', messagePayload, function(error, newPayload){
          if(error){
            if(typeof callback === 'function'){ process.nextTick(function(){ callback(error); }); }
          }else{
            var payloadToSend = {
              messageType: 'chat',
              serverToken: api.config.general.serverToken,
              serverId: api.id,
              message: newPayload.message,
              sentAt: newPayload.sentAt,
              connection: {
                id: newPayload.from,
                room: newPayload.room
              }
            };
            api.redis.publish(payloadToSend);
            if(typeof callback === 'function'){ process.nextTick(function(){ callback(null); }); }
          }
        });
      }else{
        if(typeof callback === 'function'){ process.nextTick(function(){ callback(api.config.errors.connectionNotInRoom(connection, room)); }); }
      }
    };

    api.chatRoom.generateMessagePayload = function(message){
      return {
        message: message.message,
        room: message.connection.room,
        from: message.connection.id,
        context: 'user',
        sentAt: message.sentAt
      };
    };

    api.chatRoom.incomingMessage = function(message){
      var messagePayload = api.chatRoom.generateMessagePayload(message);
      for(var i in api.connections.connections){
        api.chatRoom.incomingMessagePerConnection(api.connections.connections[i], messagePayload);
      }
    };

    api.chatRoom.incomingMessagePerConnection = function(connection, messagePayload){
      if(connection.canChat === true){
        if(connection.rooms.indexOf(messagePayload.room) > -1){
          api.chatRoom.handleCallbacks(connection, messagePayload.room, 'say', messagePayload, function(error, newMessagePayload){
            if(!error){ connection.sendMessage(newMessagePayload, 'say'); }
          });
        }
      }
    };

    api.chatRoom.list = function(callback){
      api.redis.clients.client.smembers(api.chatRoom.keys.rooms, function(error, rooms){
        if(typeof callback === 'function'){ callback(error, rooms); }
      });
    };

    api.chatRoom.add = function(room, callback){
      api.chatRoom.exists(room, function(error, found){
        if(found === false){
          api.redis.clients.client.sadd(api.chatRoom.keys.rooms, room, function(error, count){
            if(typeof callback === 'function'){ callback(error, count); }
          });
        }else{
          if(typeof callback === 'function'){ callback(api.config.errors.connectionRoomExists(room), null); }
        }
      });
    };

    api.chatRoom.destroy = function(room, callback){
      api.chatRoom.exists(room, function(error, found){
        if(found === true){
          api.chatRoom.broadcast({}, room, api.config.errors.connectionRoomHasBeenDeleted(room), function(){
            api.redis.clients.client.hgetall(api.chatRoom.keys.members + room, function(error, membersHash){

              for(var id in membersHash){
                api.chatRoom.removeMember(id, room);
              }

              api.redis.clients.client.srem(api.chatRoom.keys.rooms, room, function(){
                api.redis.clients.client.del(api.chatRoom.keys.members + room, function(){
                  if(typeof callback === 'function'){ callback(); }
                });
              });

            });
          });
        }else{
          if(typeof callback === 'function'){ callback(api.config.errors.connectionRoomNotExist(room), null); }
        }
      });
    };

    api.chatRoom.exists = function(room, callback){
      api.redis.clients.client.sismember(api.chatRoom.keys.rooms, room, function(error, bool){
        var found = false;
        if(bool === 1 || bool === true){
          found = true;
        }
        if(typeof callback === 'function'){ callback(error, found); }
      });
    };

    api.chatRoom.sanitizeMemberDetails = function(memberData){
      return {
        id: memberData.id,
        joinedAt: memberData.joinedAt
      };
    };

    api.chatRoom.roomStatus = function(room, callback){
      if(room){
        api.chatRoom.exists(room, function(error, found){
          if(found === true){
            var key = api.chatRoom.keys.members + room;
            api.redis.clients.client.hgetall(key, function(error, members){
              var cleanedMembers = {};
              var count = 0;
              for(var id in members){
                var data = JSON.parse(members[id]);
                cleanedMembers[id] = api.chatRoom.sanitizeMemberDetails(data);
                count++;
              }
              callback(null, {
                room: room,
                members: cleanedMembers,
                membersCount: count
              });
            });
          }else{
            if(typeof callback === 'function'){ callback(api.config.errors.connectionRoomNotExist(room), null); }
          }
        });
      }else{
        if(typeof callback === 'function'){ callback(api.config.errors.connectionRoomRequired(), null); }
      }
    };

    api.chatRoom.generateMemberDetails = function(connection){
      return {
        id: connection.id,
        joinedAt: new Date().getTime(),
        host: api.id
      };
    };

    api.chatRoom.addMember = function(connectionId, room, callback){
      if(api.connections.connections[connectionId]){
        var connection = api.connections.connections[connectionId];
        if(connection.rooms.indexOf(room) < 0){
          api.chatRoom.exists(room, function(error, found){
            if(found === true){
              api.chatRoom.handleCallbacks(connection, room, 'join', null, function(error){
                if(error){
                  callback(error, false);
                }else{
                  var memberDetails = api.chatRoom.generateMemberDetails(connection);
                  api.redis.clients.client.hset(api.chatRoom.keys.members + room, connection.id, JSON.stringify(memberDetails), function(){
                    connection.rooms.push(room);
                    if(typeof callback === 'function'){ callback(null, true); }
                  });
                }
              });
            }else{
              if(typeof callback === 'function'){ callback(api.config.errors.connectionRoomNotExist(room), false); }
            }
          });
        }else{
          if(typeof callback === 'function'){ callback(api.config.errors.connectionAlreadyInRoom(connection, room), false); }
        }
      }else{
        api.redis.doCluster('api.chatRoom.addMember', [connectionId, room], connectionId, callback);
      }
    };

    api.chatRoom.removeMember = function(connectionId, room, callback){
      if(api.connections.connections[connectionId]){
        var connection = api.connections.connections[connectionId];
        if(connection.rooms.indexOf(room) > -1){
          api.chatRoom.exists(room, function(error, found){
            if(found){
              api.chatRoom.handleCallbacks(connection, room, 'leave', null, function(error){
                if(error){
                  callback(error, false);
                }else{
                  api.redis.clients.client.hdel(api.chatRoom.keys.members + room, connection.id, function(){
                    var index = connection.rooms.indexOf(room);
                    if(index > -1){ connection.rooms.splice(index, 1); }
                    if(typeof callback === 'function'){ callback(null, true); }
                  });
                }
              });
            }else{
              if(typeof callback === 'function'){ callback(api.config.errors.connectionRoomNotExist(room), false); }
            }
          });
        }else{
          if(typeof callback === 'function'){ callback(api.config.errors.connectionNotInRoom(connection, room), false); }
        }
      }else{
        api.redis.doCluster('api.chatRoom.removeMember', [connectionId, room], connectionId, callback);
      }
    };

    api.chatRoom.handleCallbacks = function(connection, room, direction, messagePayload, callback){
      var jobs = [];
      var newMessagePayload;
      if(messagePayload){ newMessagePayload = api.utils.objClone(messagePayload); }

      api.chatRoom.globalMiddleware.forEach(function(name){
        var m = api.chatRoom.middleware[name];
        if(typeof m[direction] === 'function'){
          jobs.push(function(callback){
            if(messagePayload){
              m[direction](connection, room, newMessagePayload, function(error, data){
                if(data){ newMessagePayload = data; }
                callback(error, data);
              });
            }else{
              m[direction](connection, room, callback);
            }
          });
        }
      });

      async.series(jobs, function(error, data){
        while(data.length > 0){
          var thisData = data.shift();
          if(thisData){ newMessagePayload = thisData; }
        }
        callback(error, newMessagePayload);
      });
    };

    next();
  },

  start: function(api, next){
    api.redis.subscriptionHandlers.chat = function(message){
      if(api.chatRoom){
        api.chatRoom.incomingMessage(message);
      }
    };

    if(api.config.general.startingChatRooms){
      for(var room in api.config.general.startingChatRooms){
        api.log(['ensuring the existence of the chatRoom: %s', room]);
        api.chatRoom.add(room);
      }
    }

    next();
  }

};
