'use strict';

const uuid = require('node-uuid');

module.exports = {
  loadPriority:  400,
  initialize: function(api, next){

    api.connections = {

      middleware: {},
      globalMiddleware: [],

      allowedVerbs: [
        'quit',
        'exit',
        'documentation',
        'paramAdd',
        'paramDelete',
        'paramView',
        'paramsView',
        'paramsDelete',
        'roomAdd',
        'roomLeave',
        'roomView',
        'detailsView',
        'say'
      ],

      connections: {},

      apply: function(connectionId, method, args, callback){
        if(args === undefined && callback === undefined && typeof method === 'function'){
          callback = method; args = null; method = null;
        }
        api.redis.doCluster('api.connections.applyCatch', [connectionId, method, args], connectionId, callback);
      },

      applyCatch: function(connectionId, method, args, callback){
        const connection = api.connections.connections[connectionId];
        if(method && args){
          if(method === 'sendMessage' || method === 'sendFile'){
            connection[method](args);
          }else{
            connection[method].apply(connection, args);
          }
        }
        if(typeof callback === 'function'){
          process.nextTick(() => {
            callback(cleanConnection(connection));
          });
        }
      },

      addMiddleware: function(data){
        if(!data.name){ throw new Error('middleware.name is required'); }
        if(!data.priority){ data.priority = api.config.general.defaultMiddlewarePriority; }
        data.priority = Number(data.priority);
        api.connections.middleware[data.name] = data;

        this.globalMiddleware.push(data.name);
        this.globalMiddleware.sort((a, b) => {
          if(api.connections.middleware[a].priority > api.connections.middleware[b].priority){
            return 1;
          }else{
            return -1;
          }
        });
      }
    };

    const cleanConnection = function(connection){
      let clean = {};
      for(let i in connection){
        if(i !== 'rawConnection'){
          clean[i] = connection[i];
        }
      }
      return clean;
    };

    // {type: type, remotePort: remotePort, remoteIP: remoteIP, rawConnection: rawConnection}
    // id is optional and will be generated if missing
    api.connection = function(data){
      this.setup(data);
      api.connections.connections[this.id] = this;

      api.connections.globalMiddleware.forEach((middlewareName) => {
        if(typeof api.connections.middleware[middlewareName].create === 'function'){
          api.connections.middleware[middlewareName].create(this);
        }
      });
    };

    api.connection.prototype.setup = function(data){
      if(data.id){
        this.id = data.id;
      }else{
        this.id = this.generateID();
      }
      this.connectedAt = new Date().getTime();

      ['type', 'rawConnection'].forEach((req) => {
        if(data[req] === null || data[req] === undefined){ throw new Error(req + ' is required to create a new connection object'); }
        this[req] = data[req];
      });

      ['remotePort', 'remoteIP'].forEach((req) => {
        if(data[req] === null || data[req] === undefined){
          if(api.config.general.enforceConnectionProperties === true){
            throw new Error(req + ' is required to create a new connection object');
          }else{
            data[req] = 0; // could be a random uuid as well?
          }
        }
        this[req] = data[req];
      });

      const connectionDefaults = {
        error: null,
        fingerprint: this.id,
        rooms: [],
        params: {},
        pendingActions: 0,
        totalActions: 0,
        messageCount: 0,
        canChat: false
      };

      for(let i in connectionDefaults){
        if(this[i] === undefined && data[i] !== undefined){ this[i] = data[i]; }
        if(this[i] === undefined){ this[i] = connectionDefaults[i]; }
      }

      api.i18n.invokeConnectionLocale(this);
    };

    api.connection.prototype.localize = function(message){
      // this.locale will be sourced automatically
      return api.i18n.localize(message, this);
    };

    api.connection.prototype.generateID = function(){
      return uuid.v4();
    };

    api.connection.prototype.destroy = function(callback){
      this.destroyed = true;

      api.connections.globalMiddleware.forEach((middlewareName) => {
        if(typeof api.connections.middleware[middlewareName].destroy === 'function'){
          api.connections.middleware[middlewareName].destroy(this);
        }
      });

      if(this.canChat === true){
        this.rooms.forEach((room) => {
          api.chatRoom.removeMember(this.id, room);
        });
      }

      const server = api.servers.servers[this.type];

      if(server){
        if(server.attributes.logExits === true){
          server.log('connection closed', 'info', {to: this.remoteIP});
        }
        if(typeof server.goodbye === 'function'){ server.goodbye(this); }
      }

      delete api.connections.connections[this.id];

      if(typeof callback === 'function'){ callback(); }
    };

    api.connection.prototype.set = function(key, value){
      this[key] = value;
    };

    api.connection.prototype.verbs = function(verb, words, callback){
      let key;
      let value;
      let room;
      const server = api.servers.servers[this.type];
      const allowedVerbs = server.attributes.verbs;
      if(typeof words === 'function' && !callback){
        callback = words;
        words = [];
      }
      if(!(words instanceof Array)){
        words = [words];
      }
      if(server && allowedVerbs.indexOf(verb) >= 0){
        server.log('verb', 'debug', {verb: verb, to: this.remoteIP, params: JSON.stringify(words)});
        if(verb === 'quit' || verb === 'exit'){
          server.goodbye(this);

        }else if(verb === 'paramAdd'){
          key = words[0];
          value = words[1];
          if((words[0]) && (words[0].indexOf('=') >= 0)){
            let parts = words[0].split('=');
            key = parts[0];
            value = parts[1];
          }
          if(api.config.general.disableParamScrubbing || api.params.postVariables.indexOf(key) > 0){
            this.params[key] = value;
          }
          if(typeof callback === 'function'){ callback(null, null); }
        }else if(verb === 'paramDelete'){
          key = words[0];
          delete this.params[key];
          if(typeof callback === 'function'){ callback(null, null); }

        }else if(verb === 'paramView'){
          key = words[0];
          if(typeof callback === 'function'){ callback(null, this.params[key]); }

        }else if(verb === 'paramsView'){
          if(typeof callback === 'function'){ callback(null, this.params); }

        }else if(verb === 'paramsDelete'){
          for(let i in this.params){
            delete this.params[i];
          }
          if(typeof callback === 'function'){ callback(null, null); }

        }else if(verb === 'roomAdd'){
          room = words[0];
          api.chatRoom.addMember(this.id, room, (error, didHappen) => {
            if(typeof callback === 'function'){ callback(error, didHappen); }
          });

        }else if(verb === 'roomLeave'){
          room = words[0];
          api.chatRoom.removeMember(this.id, room, (error, didHappen) => {
            if(typeof callback === 'function'){ callback(error, didHappen); }
          });

        }else if(verb === 'roomView'){
          room = words[0];
          if(this.rooms.indexOf(room) > -1){
            api.chatRoom.roomStatus(room, (error, roomStatus) => {
              if(typeof callback === 'function'){ callback(error, roomStatus); }
            });
          }else{
            if(typeof callback === 'function'){ callback('not member of room ' + room); }
          }

        }else if(verb === 'detailsView'){
          let details            = {};
          details.id             = this.id;
          details.fingerprint    = this.fingerprint;
          details.remoteIP       = this.remoteIP;
          details.remotePort     = this.remotePort;
          details.params         = this.params;
          details.connectedAt    = this.connectedAt;
          details.rooms          = this.rooms;
          details.totalActions   = this.totalActions;
          details.pendingActions = this.pendingActions;
          if(typeof callback === 'function'){ callback(null, details); }

        }else if(verb === 'documentation'){
          if(typeof callback === 'function'){ callback(null, api.documentation.documentation); }

        }else if(verb === 'say'){
          room = words.shift();
          api.chatRoom.broadcast(this, room, words.join(' '), (error) => {
            if(typeof callback === 'function'){ callback(error); }
          });

        }else{
          if(typeof callback === 'function'){ callback(api.config.errors.verbNotFound(this, verb), null); }
        }
      }else{
        if(typeof callback === 'function'){ callback(api.config.errors.verbNotAllowed(this, verb), null); }
      }
    };

    next();
  }
};
