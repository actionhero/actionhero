var chatRoom = function(api, next){

  api.chatRoom = {};
  api.chatRoom.keys = {
    // set
    rooms:   'actionHero:chatRoom:rooms',
    // prefix to hashes
    members: 'actionHero:chatRoom:members:',
    // hash
    auth:    'actionHero:chatRoom:auth'
  }
  api.chatRoom.fayeChannel = '/actionHero/chat';

  api.chatRoom._start = function(api, next){
    api.chatRoom.subscription = api.faye.client.subscribe(api.chatRoom.fayeChannel, function(message){
      api.chatRoom.incomingMessage(message);
    });
    if(null !== api.config.general.startingChatRooms){
      for(var room in api.config.general.startingChatRooms){
        api.log('ensuring the existence of the chatRoom: ' + room);
        api.chatRoom.add(room, function(err){
          if(null !== err){ api.log(err, 'crit') }
          if(null !== api.config.general.startingChatRooms[room]){
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

  api.chatRoom._teardown = function(api, next){
    api.chatRoom.subscription.cancel();
    next();
  }

  api.chatRoom.socketRoomBroadcast = function(connection, message, callback){
    // connection.room is required
    if(null !== connection.room){
      if(null === connection.id){ connection.id = 0 }
      api.stats.increment('chatRoom:messagesSent');
      api.stats.increment('chatRoom:messagesSent:' + connection.room);
      var payload = {
        serverToken: api.config.general.serverToken,
        serverId: api.id,
        message: message,
        sentAt: new Date().getTime(),
        connection: {
          id: connection.id,
          room: connection.room
        }
      };
      api.faye.client.publish(api.chatRoom.fayeChannel, payload);
      if('function' === typeof callback){ callback(null) }
    } else {
      if('function' === typeof callback){ callback('connection not in a room') }
    }
  }

  api.chatRoom.incomingMessage = function(message){
    api.stats.increment('chatRoom:messagesReceived');
    var messagePayload = {message: message.message, room: message.connection.room, from: message.connection.id, context: 'user', sentAt: message.sentAt };
    for(var i in api.connections.connections){
      var thisConnection = api.connections.connections[i];
      if(true === thisConnection.canChat){
        if(thisConnection.room === message.connection.room || thisConnection.listeningRooms.indexOf(message.connection.room) > -1){
          if(null === message.connection || thisConnection.id !== message.connection.id){
            thisConnection.sendMessage(messagePayload, 'say');
          }
        }
      }
    }
  }

  api.chatRoom.add = function(room, callback){
    api.redis.client.sadd(api.chatRoom.keys.rooms, room, function(err, count){
      if('function' === typeof callback){ callback(err, count) }
    });
  }

  api.chatRoom.del = function(room, callback){
    api.chatRoom.socketRoomBroadcast({room: room}, 'this room has been deleted');
    api.redis.client.srem(api.chatRoom.keys.rooms, room, function(err){
      api.redis.client.hgetall(api.chatRoom.keys.members + room, function(err, membersHash){
        for(var id in membersHash){
          // api.chatRoom.removeMember()? //TODO rebroadcast this to all nodes to disconnect connections they manage
        }
      });
      api.redis.client.del(api.chatRoom.keys.members + room, function(err){
        api.chatRoom.setAuthenticationPattern(room, null, null, function(){
          if('function' === typeof callback){ callback() }
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
      if('function' === typeof callback){ callback(err, found) }
    });
  }
  
  api.chatRoom.setAuthenticationPattern = function(room, key, value, callback){
    if(null === key){
      api.redis.client.hdel(api.chatRoom.keys.auth, room, function(err){
        if('function' === typeof callback){ callback(err) }
      });
    } else {
      var data = {}
      data[key] = value;
      api.redis.client.hset(api.chatRoom.keys.auth, room, JSON.stringify(data), function(err){
        if('function' === typeof callback){ callback(err) }
      });
    }
  }

  api.chatRoom.roomStatus = function(room, callback){
    if(null !== room){
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
      if(null !== rawAuth){ auth = JSON.parse(rawAuth) }
      var authorized = true;
      for(var k in auth){
        if(null === connection[k] || auth[k] !== connection[k]){
          authorized = false;
        }
      }
      callback(err, authorized);
    });
  }

  api.chatRoom.addMember = function(connection, room, callback){
    api.chatRoom.exists(room, function(err, found){
      if(null === err && true === found){
        api.chatRoom.authorize(connection, room, function(err, authorized){
          if(true === authorized){
            api.redis.client.hget(api.chatRoom.keys.members + room, connection.id, function(err, memberDetails){
              if(null === memberDetails){
                memberDetails = {
                  id:       connection.id,
                  joinedAt: new Date().getTime(),
                  host:     api.id
                };
                api.chatRoom.removeMember(connection, function(){
                  connection.room = null;
                  api.redis.client.hset(api.chatRoom.keys.members + room, connection.id, JSON.stringify(memberDetails), function(err){
                    connection.room = room;
                    api.stats.increment('chatRoom:roomMembers:' + connection.room);
                    api.chatRoom.announceMember(connection, true);
                    if('function' === typeof callback){ callback(null, true) }
                  });
                });
              } else {
                if('function' === typeof callback){ callback('connection already in this room', false) }
              }
            });
          } else {
            if('function' === typeof callback){ callback('not authorized to join room', false) }
          }
        });
      } else {
        if('function' === typeof callback){ callback('room does not exist', false) }
      }
    });
  }

  api.chatRoom.removeMember = function(connection, callback){
    if(null !== connection.room){
      api.stats.increment('chatRoom:roomMembers:' + connection.room, -1);
      api.redis.client.hdel(api.chatRoom.keys.members + connection.room, connection.id, function(err){
        api.chatRoom.announceMember(connection, false);
        connection.room = null;
        if('function' === typeof callback){ callback(null, true) }
      });
    } else {
      if('function' === typeof callback){ callback(null, false) }
    }
  }

  api.chatRoom.listenToRoom = function(connection, room, callback){
    if(connection.listeningRooms.indexOf(room) < 0){
      api.chatRoom.exists(room, function(err, found){
        if(null === err && true === found){
          api.chatRoom.authorize(connection, room, function(err, authorized){
            if(true === authorized){
              connection.listeningRooms.push(room);
              if('function' === typeof callback){ callback(null, true) }
            } else {
              if('function' === typeof callback){ callback('not authorized to join room', false) }
            }
          });
        } else {
          if('function' === typeof callback){ callback('room does not exist', false) }
        }
      });
    } else {
      if('function' === typeof callback){ callback('connection already listening to this room', false) }
    }
  }

  api.chatRoom.silenceRoom = function(connection, room, callback){
    if(connection.listeningRooms.indexOf(room) >= 0){
      var index = connection.listeningRooms.indexOf(room);
      connection.listeningRooms.splice(index, 1);
      if('function' === typeof callback){ callback(null, true) }
    } else {
      if('function' === typeof callback){ callback('connection not listening to this room', false) }
    }
  }

  api.chatRoom.announceMember = function(connection, direction){
    var message = 'I';
    if(true === direction){
      message += ' have entered the room';
    } else {
      message += ' have left the room';
    }

    api.chatRoom.socketRoomBroadcast(connection, message);
  }

  next();
}

/////////////////////////////////////////////////////////////////////
// exports
exports.chatRoom = chatRoom;
