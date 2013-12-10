var uuid = require('node-uuid');

var connections = function(api, next){

  api.connections = {

    createCallbacks: [],
    destroyCallbacks: [],

    allowedVerbs: [
      'quit',
      'exit',
      'documentation',
      'paramAdd',
      'paramDelete',
      'paramView',
      'paramsView',
      'paramsDelete',
      'roomChange',
      'roomLeave',
      'roomView',
      'listenToRoom',
      'silenceRoom',
      'detailsView',
      'say'
    ],

    connections: {}
  };
  

  // {type: type, remotePort: remotePort, remoteIP: remoteIP, rawConnection: rawConnection}
  // id is optional and will be generated if missing
  api.connection = function(data){
    this.setup(data)
    api.stats.increment('connections:totalActiveConnections');
    api.stats.increment('connections:activeConnections:' + this.type);
    api.stats.increment('connections:totalConnections');
    api.stats.increment('connections:connections:' + this.type);
    api.connections.connections[this.id] = this;
    for(var i in api.connections.createCallbacks){
      api.connections.createCallbacks[i](this);
    }
  }

  api.connection.prototype.setup = function(data){
    var self = this;
    if(null !== data.id){
      self.id = data.id;
    } else {
      self.id = self.generateID();
    }
    self.connectedAt = new Date().getTime();
    ['type', 'remotePort', 'remoteIP', 'rawConnection'].forEach(function(req){
      if(null === data[req]){ throw new Error(req + ' is required to create a new connection object') }
      self[req] = data[req];
    });

    var connectionDefaults = {
      error: null,
      params: {},
      response: {},
      pendingActions: 0,
      totalActions: 0,
      messageCount: 0,
      listeningRooms: [],
      roomMatchKey: null,
      roomMatchValue: null,
      room: api.config.general.defaultChatRoom,
      canChat: false
    }

    for(var i in connectionDefaults){
      self[i] = connectionDefaults[i];
    }
  }

  api.connection.prototype.generateID = function(){
    return uuid.v4();
  }

  api.connection.prototype.sendMessage = function(message){
    throw new Error('I should be replaced with a connection-specific method');
  }

  api.connection.prototype.destroy = function(callback){
    var self = this;
    for(var i in api.connections.destroyCallbacks){
      api.connections.destroyCallbacks[i](self);
    }
    api.stats.increment('connections:totalActiveConnections', -1);
    api.stats.increment('connections:activeConnections:' + self.type, -1);
    if(self.canChat === true){ api.chatRoom.removeMember(self); }
    delete api.connections.connections[self.id];
    if('function' === typeof callback){ callback() }
  }

  api.connection.prototype.verbs = function(verb, words, callback){
    var self = this;
    var key,value,room;
    var server = api.servers.servers[self.type];
    var allowedVerbs = server.attributes.verbs;
    if(allowedVerbs.indexOf(verb) >= 0){
      server.log('verb', 'debug', {verb: verb, to: self.remoteIP, params: JSON.stringify(words)});
      if('quit' === verb || 'exit' === verb){
        server.goodbye(self, verb + ' requested');

      } else if('paramAdd' === verb){
        key = words[0];
        value = words[1];
        if(words[0].indexOf('=') >= 0){
          var parts = words[0].split('=');
          key = parts[0];
          value = parts[1];
        }
        self.params[key] = value;
        callback(null, null);
      } else if('paramDelete' === verb){
        key = words[0];
        delete self.params[key];
        callback(null, null);
      } else if('paramView' === verb){
        key = words[0];
        callback(null, self.params[key]);
      } else if('paramsView' === verb){
        callback(null, self.params);
      } else if('paramsDelete' === verb){
        for(var i in self.params){
          delete self.params[i];
        }
        callback(null, null);
      } else if('roomChange' === verb){
        room = words[0];
        api.chatRoom.addMember(self, room, function(err, didHappen){
          callback(err, didHappen);
        });
      } else if('roomLeave' === verb){
        api.chatRoom.removeMember(self, function(err, didHappen){
          callback(err, didHappen);
        });
      } else if('roomView' === verb){
        api.chatRoom.roomStatus(self.room, function(err, roomStatus){
          callback(err, roomStatus);
        });
      } else if('listenToRoom' === verb){
        room = words[0];
        api.chatRoom.listenToRoom(self, room, function(err, didHappen){
          callback(err, didHappen);
        });
      } else if('silenceRoom' === verb){
        room = words[0];
        api.chatRoom.silenceRoom(self, room, function(err, didHappen){
          callback(err, didHappen);
        });
      } else if('detailsView' === verb){
        var details = {}
        details.id = self.id;
        details.remoteIP = self.remoteIP;
        details.remotePort = self.remotePort;
        details.params = self.params;
        details.connectedAt = self.connectedAt;
        details.room = self.room;
        details.totalActions = self.totalActions;
        details.pendingActions = self.pendingActions;
        callback(null, details);
      } else if('documentation' === verb){
        callback(null, api.documentation.documentation);
      } else if('say' === verb){
        api.chatRoom.socketRoomBroadcast(self, words.join(' '), function(err){
          callback(err);
        });
      } else {
        callback('I do not know know to perform this verb', null);
      }
    } else {
      callback('verb not found or not allowed', null);
    }
  }

  next();
}

exports.connections = connections;
