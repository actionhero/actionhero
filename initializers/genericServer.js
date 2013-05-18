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
        canChat: true,
        logConnections: true,
        logExits: true,
        sendWelcomeMessage: true,
        verbs: [],
      }

      var server = new api.genericServer(type, options, attributes);

      //////////////////////
      // REQUIRED METHODS //
      //////////////////////

      server._start = function(next){}

      server._teardown = function(next){}

      server.sendMessage = function(connection, message, messageCount){}

      server.sendFile = function(connection, error, fileStream, mime, length){};

      server.goodbye = function(connection, reason){};

      ////////////
      // EVENTS //
      ////////////

      server.on("connection", function(connection){});

      server.on("actionComplete", function(connection, toRender, messageCount){});

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
  // attributes are descrptions of the server:
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

    // you can overwrite attributes with options
    // this could cause some problems, be careful
    for(var key in this.options){
      if(this.attributes[key] != null){
        this.attributes[key] = this.options[key];
      }
    }

    api.stats.set("connections:connections:" + this.type, 0);
    api.stats.set("connections:activeConnections:" + this.type, 0);
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
    if(typeof self.attributes.sendWelcomeMessage === "number"){
      setTimeout(function(){
        try{
          connection.sendMessage({welcome: api.configData.general.welcomeMessage, room: connection.room, context: "api"})
        }catch(e){
          api.log(e, "error");
        }
      }, self.attributes.sendWelcomeMessage);
    }
    if(self.attributes.canChat === true){
      connection.canChat = true;
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

  api.genericServer.prototype.processAction = function(connection){
    var self = this;
    var actionProcessor = new api.actionProcessor({
      connection: connection, 
      callback: function(connection, toRender, messageCount){
        self.emit("actionComplete", connection, toRender, messageCount);
      }
    });
    actionProcessor.processAction();
  }

  api.genericServer.prototype.processFile = function(connection){
    var self = this;
    api.staticFile.get(connection, function(connection, error, fileStream, mime, length){
      self.sendFile(connection, error, fileStream, mime, length);
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

  // This method will be used to gracefully disconnect the client
  api.genericServer.prototype.goodbye = function(connection, reason){ methodNotDefined(); }

  next();

};

exports.genericServer = genericServer;