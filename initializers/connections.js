var uuid = require("node-uuid");

var connections = function(api, next){

  api.connections = {
    
    resetLocalConnectionStats : function(next){
      api.stats.set("connections:totalActiveConnections", 0);
      api.stats.set("connections:totalConnections", 0);
      next();
    },

    _start: function(api, next){
      api.connections.resetLocalConnectionStats(function(){
        next();
      });
    },

    _teardown: function(api, next){
      api.connections.resetLocalConnectionStats(function(){
        next();
      });
    },

    allowedVerbs: [
      "quit", 
      "exit",
      "documentation",
      "paramAdd",
      "paramDelete",
      "paramView",
      "paramsView",
      "paramsDelete",
      "roomChange",
      "roomView",
      "listenToRoom",
      "silenceRoom",
      "detailsView",
      "say"
    ],

    connections: {}
  };
  

  // {type: type, remotePort: remotePort, remoteIP: remoteIP, rawConnection: rawConnection}
  // id is optional and will be generated if missing
  api.connection = function(data){
    this.setup(data)
    api.stats.increment("connections:totalActiveConnections");
    api.stats.increment("connections:activeConnections:" + this.type);
    api.stats.increment("connections:totalConnections");
    api.stats.increment("connections:connections:" + this.type);
    api.connections.connections[this.id] = this;
  }

  api.connection.prototype.setup = function(data){
    var self = this;
    if(data.id != null){
      self.id = data.id;
    }else{
      self.id = self.generateID();
    }
    self.connectedAt = new Date().getTime();
    ['type', 'remotePort', 'remoteIP', 'rawConnection'].forEach(function(req){
      if(data[req] == null){ throw new Error(req + ' is required to create a new connection object'); }
      self[req] = data[req];
    });

    var connectionDefaults = {
      error: null,
      params: {},
      response: {},
      pendingActions: 0,
      totalActions: 0,
      messageCount: 0,
      additionalListeningRooms: [],
      roomMatchKey: null,
      roomMatchValue: null,
      room: api.configData.general.defaultChatRoom,
      canChat: false,
    }

    for(var i in connectionDefaults){
      self[i] = connectionDefaults[i];
    }
  }

  api.connection.prototype.generateID = function(){
    return uuid.v4();
  }

  api.connection.prototype.sendMessage = function(message){
    throw new Error("I should be replaced with a connection-specific method");
  }

  api.connection.prototype.destroy = function(callback){
    var self = this;
    api.stats.increment("connections:totalActiveConnections", -1, function(){
      api.stats.increment("connections:activeConnections:" + self.type, -1, function(){
        if(self.canChat === true){ api.chatRoom.roomRemoveMember(self); }
        delete api.connections.connections[self.id];
        if(typeof callback == "function"){ callback(); }
      });
    });
  }

  api.connection.prototype.verbs = function(verb, words, callback){
    var self = this;
    var server = api.servers.servers[self.type];
    var allowedVerbs = server.attributes.verbs;
    if(allowedVerbs.indexOf(verb) >= 0){
      server.log("verb", 'debug', {verb: verb, to: self.remoteIP, params: JSON.stringify(words)});
        if(verb === "quit" || verb === "exit"){
          server.goodbye(self, verb + " requested");

        }else if(verb === "paramAdd"){
          if(words[0].indexOf("=") >= 0){
            var parts = words[0].split("=");
            var key = parts[0];
            var value = parts[1];
            self.params[key] = value;
          }else{
            var key = words[0];
            var value = words[1];
            self.params[key] = value;
          }
          callback(null, null);

        }else if(verb === "paramDelete"){
          var key = words[0];
          delete self.params[key];
          callback(null, null);

        }else if(verb === "paramView"){
          var key = words[0];
          callback(null, self.params[key]);

        }else if(verb === "paramsView"){
          callback(null, self.params);

        }else if(verb === "paramsDelete"){
          for(var i in self.params){
            delete self.params[i];
          }
          callback(null, null);

        }else if(verb === "roomChange"){
          api.chatRoom.roomRemoveMember(self, function(err, wasRemoved){
            self.room = words[0];
            api.chatRoom.roomAddMember(self);
            callback(null, wasRemoved);
          });

        }else if(verb === "roomView"){
          api.chatRoom.socketRoomStatus(self.room, function(err, roomStatus){
            callback(null, roomStatus);
          });

        }else if(verb === "listenToRoom"){
          if(self.additionalListeningRooms.indexOf(words[0]) >= 0){
            callback("alredy listening to this room", null);
          }else{
            self.additionalListeningRooms.push(words[0]);
            callback(null, null);
          }

        }else if(verb === "silenceRoom"){
          if(self.additionalListeningRooms.indexOf(words[0]) >= 0){
            var index = self.additionalListeningRooms.indexOf(words[0]);
            self.additionalListeningRooms.splice(index, 1);
            callback(null, null);
          }else{
            callback("you are not listening to this room", null);
          }

        }else if(verb === "detailsView"){
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

        }else if(verb === "documentation"){
          callback(null, api.documentation.documentation);

        }else if(verb === "say"){
          api.chatRoom.socketRoomBroadcast(self, words.join(" "));
          callback(null, null);

        }else{
          callback("I do not know know to perform this verb", null);
        }
    }else{
      callback("verb not found or not allowed", null);
    }
  }

  next();
}

exports.connections = connections;