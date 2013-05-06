var EventEmitter = require('events').EventEmitter;
var util = require('util');

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
    self.emit("connection", connection);
    if(self.attributes.canChat === true){
      api.chatRoom.roomAddMember(connection);
    }
  }

  api.genericServer.prototype.processAction = function(connection){
    var self = this;
    process.nextTick(function() { 
      var actionProcessor = new api.actionProcessor({
        connection: connection, 
        callback: function(connection, toRender){
          self.emit("actionComplete", connection, toRender);
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