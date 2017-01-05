'use strict';

const EventEmitter = require('events').EventEmitter;
const util = require('util');

module.exports = {
  loadPriority:  450,
  initialize: function(api, next){
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
      for(let key in this.options){
        if(this.attributes[key] !== null && this.attributes[key] !== undefined){
          this.attributes[key] = this.options[key];
        }
      }
    };

    util.inherits(api.genericServer, EventEmitter);

    api.genericServer.prototype.buildConnection = function(data){
      const details = {
        type: this.type,
        id: data.id,
        remotePort: data.remotePort,
        remoteIP: data.remoteAddress,
        rawConnection: data.rawConnection
      };
      if(this.attributes.canChat === true){ details.canChat = true; }
      if(data.fingerprint){ details.fingerprint = data.fingerprint; }
      let connection = new api.connection(details);

      connection.sendMessage = (message) => {
        this.sendMessage(connection, message);
      };

      connection.sendFile = (path) => {
        connection.params.file = path;
        this.processFile(connection);
      };

      this.emit('connection', connection);

      if(this.attributes.logConnections === true){
        this.log('new connection', 'info', {to: connection.remoteIP});
      }

      if(this.attributes.sendWelcomeMessage === true){
        connection.sendMessage({welcome: api.config.general.welcomeMessage, context: 'api'});
      }

      if(typeof this.attributes.sendWelcomeMessage === 'number'){
        setTimeout(() => {
          try{
            connection.sendMessage({welcome: api.config.general.welcomeMessage, context: 'api'});
          }catch(e){
            api.log(e, 'error');
          }
        }, this.attributes.sendWelcomeMessage);
      }
    };

    api.genericServer.prototype.processAction = function(connection){
      const actionProcessor = new api.actionProcessor(connection, (data) => {
        this.emit('actionComplete', data);
      });

      actionProcessor.processAction();
    };

    api.genericServer.prototype.processFile = function(connection){
      api.staticFile.get(connection, (connection, error, fileStream, mime, length, lastModified) => {
        this.sendFile(connection, error, fileStream, mime, length, lastModified);
      });
    };

    api.genericServer.prototype.connections = function(){
      let connections = [];

      for(let i in api.connections.connections){
        let connection = api.connections.connections[i];
        if(connection.type === this.type){ connections.push(connection); }
      }

      return connections;
    };

    api.genericServer.prototype.log = function(message, severity, data){
      api.log(['[server: %s] %s', this.type, message], severity, data);
    };

    const methodNotDefined = function(){
      throw new Error('The containing method should be defined for this server type');
    };

    ///////////////////////////////////////
    // METHODS WHICH MUST BE OVERWRITTEN //
    ///////////////////////////////////////

    // I am invoked as part of boot
    api.genericServer.prototype.start = function(next){ methodNotDefined(); };

    // I am invoked as part of shutdown
    api.genericServer.prototype.stop = function(next){ methodNotDefined(); };

    // This method will be appended to the connection as 'connection.sendMessage'
    api.genericServer.prototype.sendMessage = function(connection, message){ methodNotDefined(); };

    // This method will be used to gracefully disconnect the client
    api.genericServer.prototype.goodbye = function(connection, reason){ methodNotDefined(); };

    next();

  }
};
