var EventEmitter = require('events').EventEmitter;
var util = require('util');

var genericServer = function(api, next){
  // I am the prototypical generic server that all other types of servers inherit from.
  // I shouldn't actually be used by a client
  // Note the methods in this template server, as they are all required for 'real' servers

  ////////////////////
  // COMMON METHODS //
  ////////////////////

  // options are meant to be configurable in 'config.js'
  // attributes are descriptions of the server:
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
    if(self.attributes.canChat === true){
      connection.canChat = true;
    }
    connection.sendMessage = function(message){
      self.sendMessage(connection, message);
    }
    connection.sendFile = function(path){
      connection.params.file = path;
      self.processFile(connection);
    }
    self.emit('connection', connection);

    if(self.attributes.logConnections === true){
      self.log('new connection', 'info', {to: connection.remoteIP});
    }
    
    if(self.attributes.sendWelcomeMessage === true){
      connection.sendMessage({welcome: api.config.general.welcomeMessage, context: 'api'})
    }
    if(typeof self.attributes.sendWelcomeMessage === 'number'){
      setTimeout(function(){
        try {
          connection.sendMessage({welcome: api.config.general.welcomeMessage, context: 'api'})
        } catch(e){
          api.log(e, 'error');
        }
      }, self.attributes.sendWelcomeMessage);
    }
  }

  api.genericServer.prototype.destroyConnection = function(connection){
    var self = this;
    if(self.attributes.logExits === true){
      self.log('connection closed', 'info', {to: connection.remoteIP});
    }
    connection.destroy();
  }

  api.genericServer.prototype.processAction = function(connection){
    var self = this;
    var actionProcessor = new api.actionProcessor({
      connection: connection,
      callback: function(connection, toRender, messageCount){
        self.emit('actionComplete', connection, toRender, messageCount);
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
    api.log('[server: ' + this.type + '] ' + message, severity, data);
  }

  var methodNotDefined = function(){
    throw new Error('The containing method should be defined for this server type');
  }

  ///////////////////////////////////////
  // METHODS WHICH MUST BE OVERWRITTEN //
  ///////////////////////////////////////

  // I am invoked as part of boot
  api.genericServer.prototype._start = function(next){ methodNotDefined() }

  // I am invoked as part of shutdown
  api.genericServer.prototype._stop = function(next){ methodNotDefined() }

  // This method will be appended to the connection as 'connection.sendMessage'
  api.genericServer.prototype.sendMessage = function(connection, message){ methodNotDefined() }

  // This method will be used to gracefully disconnect the client
  api.genericServer.prototype.goodbye = function(connection, reason){ methodNotDefined() }

  next();

};

exports.genericServer = genericServer;
