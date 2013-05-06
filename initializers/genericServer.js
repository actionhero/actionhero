var EventEmitter = require('events').EventEmitter;
var util = require('util');

/*

A generic imaplmentation of a server:

var myServer = function(api, options, next){
  
  //////////
  // INIT //
  //////////

  var type = "myServer"
  var attributes = {
    canChat: true
  }

  var server = new api.genericServer(type, options, attributes);

  //////////////////////
  // REQUIRED METHODS //
  //////////////////////

  server._start = function(next){}

  server._teardown = function(next){}

  server.sendMessage = function(connection, message){}

  server.sendFile = function(connection, content, mime, length){};

  ////////////
  // EVENTS //
  ////////////

  server.on("connection", function(connection){});

  server.on("actionComplete", function(connection, toRender){});

  /////////////
  // HELPERS //
  /////////////

  next(server);
}

/////////////////////////////////////////////////////////////////////
// exports
exports.myServer = myServer;

*/

var genericServer = function(api, next){
  // I am the prototypical generic server that all other types of servers inherit from.
  // I shouldn't actually be used by a client
  // Note the methods in this template server, as they are all required for "real" servers

  ////////////////////
  // COMMON METHODS //
  ////////////////////

  // options are meant to be configrable in `config.js`
  // attributes are descrptions of the server and cannot be changed at implamentation:
  /* 

    attributes = {
      canChat: true,
      logConnections: true,
      logExits: true,
      sendWelcomeMessage: true,
      verbs: ['say', 'detailsView']
    }

  */

  api.genericServer = function(name, options, attributes){
    this.type = name;
    this.options = options;
    this.attributes = attributes;
  }
  util.inherits(api.genericServer, EventEmitter);

  api.genericServer.prototype.buildConnection = function(data){
    var self = this;
    var connection = new api.connection({
      type: self.type, 
      id: data.id,
      remotePort: data.remotePort, 
      remoteIP: data.remoteAddress, 
      rawConnection: data.rawConnection
    });
    connection.sendMessage = function(message){
      self.sendMessage(connection, message);
    }
    self.emit("connection", connection);
    if(self.attributes.logConnections === true){
      self.log("new connection", 'info', {to: connection.remoteIP});
    }
    if(self.attributes.sendWelcomeMessage === true){
      connection.sendMessage({welcome: api.configData.general.welcomeMessage, room: connection.room, context: "api"})
    }
    if(self.attributes.canChat === true){
      api.chatRoom.roomAddMember(connection);
    }
  }

  api.genericServer.prototype.destroyConnection = function(connection){
    var self = this;
    if(self.attributes.logExits === true){
      self.log("connection closed", 'info', {to: connection.remoteIP});
    }
    connection.destroy();
  }

  api.genericServer.prototype.verbParser = function(connection, verb, words, callback){
    var self = this;
    if(self.attributes.verbs.indexOf(verb) >= 0){
      self.log("verb", 'debug', {verb: verb, to: connection.remoteIP, params: JSON.stringify(words)});
        if(verb === "paramAdd"){
          if(words[0].indexOf("=") >= 0){
            var parts = words[0].split("=");
            var key = parts[0];
            var value = parts[1];
            connection.params[key] = value;
          }else{
            var key = words[0];
            var value = words[1];
            connection.params[key] = value;
          }
          callback(null, null);

        }else if(verb === "paramDelete"){
          var key = words[0];
          delete connection.params[key];
          callback(null, null);

        }else if(verb === "paramView"){
          var key = words[0];
          callback(null, connection.params[key]);

        }else if(verb === "paramsView"){
          callback(null, connection.params);

        }else if(verb === "paramsDelete"){
          for(var i in connection.params){
            delete connection.params[i];
          }
          callback(null, null);

        }else if(verb === "roomChange"){
          api.chatRoom.roomRemoveMember(connection, function(err, wasRemoved){
            connection.room = words[0];
            api.chatRoom.roomAddMember(connection);
            callback(null, wasRemoved);
          });

        }else if(verb === "roomView"){
          api.chatRoom.socketRoomStatus(connection.room, function(err, roomStatus){
            callback(null, roomStatus);
          });

        }else if(verb === "listenToRoom"){
          if(connection.additionalListeningRooms.indexOf(words[0]) >= 0){
            callback("alredy listening to this room", null);
          }else{
            connection.additionalListeningRooms.push(words[0]);
            callback(null, null);
          }

        }else if(verb === "silenceRoom"){
          if(connection.additionalListeningRooms.indexOf(words[0]) >= 0){
            var index = connection.additionalListeningRooms.indexOf(words[0]);
            connection.additionalListeningRooms.splice(index, 1);
            callback(null, null);
          }else{
            callback("you are not listening to this room", null);
          }

        }else if(verb === "detailsView"){
          var details = {}
          details.id = connection.id;
          details.params = connection.params;
          details.connectedAt = connection.connectedAt;
          details.room = connection.room;
          details.totalActions = connection.totalActions;
          details.pendingActions = connection.pendingActions;
          callback(null, details);

        }else if(verb === "say"){
          api.chatRoom.socketRoomBroadcast(connection, words.join(" "));
          callback(null, null);

        }else{
          callback("I do not know know to perform this verb", null);
        }
    }else{
      callback("verb not found or not allowed", null);
    }
  }

  api.genericServer.prototype.processAction = function(connection){
    var self = this;
    process.nextTick(function() { 
      var actionProcessor = new api.actionProcessor({
        connection: connection, 
        callback: function(connection, toRender, messageCount){
          self.emit("actionComplete", connection, toRender, messageCount);
        }
      });
      actionProcessor.processAction();
    });
  }

  api.genericServer.prototype.processFile = function(connection){
    var self = this;
    process.nextTick(function() { 
      api.staticFile.get(connection, function(connection, content, mime, length){
        self.sendFile(connection, content, mime, length);
      });
    });
  }

  api.genericServer.prototype.connections = function(){
    var self = this;
    var connections = [];
    for(var i in api.connections.connections){
      var connection = api.connections.connections[i];
      if(connection.type === self.type){
        connections.push(connection);
      }
    }
    return connections;
  }

  api.genericServer.prototype.log = function(message, severity, data){
    api.log("[server: " + this.type + "] " + message, severity, data);
  }

  var methodNotDefined = function(){
    throw new Error('The containing method should be defined for this server type');
  }

  ///////////////////////////////////////
  // METHODS WHICH MUST BE OVERWRITTEN //
  ///////////////////////////////////////

  // I am invoked as part of boot
  api.genericServer.prototype._start = function(next){ methodNotDefined(); }

  // I am invoked as part of shutdown
  api.genericServer.prototype._teardown = function(next){ methodNotDefined(); }

  // This method will be appended to the connection as `connection.sendMessage`
  api.genericServer.prototype.sendMessage = function(connection, message){ methodNotDefined(); }

  next();

};

exports.genericServer = genericServer;