var uuid = require("node-uuid");

var connections = function(api, next){

    api.connections = {
      resetLocalConnectionStats : function(next){
        api.stats.set("connections:toatalActiveConnections", 0);
        api.stats.set("connections:toatalConnections", 0);

        ['web', 'socket', 'webSocket'].forEach(function(type){
          api.stats.set("connections:connections:" + type, 0);
          api.stats.set("connections:activeConnections:" + type, 0);
        })
        
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
      connections: {}
    };
    

    // {type: type, remotePort: remotePort, remoteIP: remoteIP, rawConnection: rawConnection}
    // id is optional
    api.connection = function(data){
      this.setup(data)
      this.joinRoomOnConnect();
      api.stats.increment("connections:toatalActiveConnections");
      api.stats.increment("connections:activeConnections:" + this.type);
      api.stats.increment("connections:toatalConnections");
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
      }

      for(var i in connectionDefaults){
        self[i] = connectionDefaults[i];
      }
    }

    api.connection.prototype.joinRoomOnConnect = function(){
      if(api.connections.connections[this.id] == null){
        if(this.type != "web" || (this.type == "web" && api.configData.commonWeb.httpClientMessageTTL > 0 )){
          api.chatRoom.roomAddMember(this);
        }
      }
    }

    api.connection.prototype.generateID = function(){
      return uuid.v4();
    }

    api.connection.prototype.destroy = function(callback){
      var self = this;
      api.stats.increment("connections:toatalActiveConnections", -1, function(){
        api.stats.increment("connections:activeConnections:" + self.type, -1, function(){
          if(self.type == "web" && api.configData.commonWeb.httpClientMessageTTL == null ){
            delete api.connections.connections[self.id]
            if(typeof callback == "function"){ callback(); }
          }else{
            api.chatRoom.roomRemoveMember(self, function(err, wasRemoved){
              delete api.connections.connections[self.id];
              if(typeof callback == "function"){ callback(); }
            }); 
          }
        });
      });
    }

  next();
}

exports.connections = connections;