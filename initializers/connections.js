'use strict';

var uuid = require('node-uuid');

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
        var connection = api.connections.connections[connectionId];
        if(method && args){
          if(method === 'sendMessage' || method === 'sendFile'){
            connection[method](args);
          }else{
            connection[method].apply(connection, args);
          }
        }
        if(typeof callback === 'function'){
          process.nextTick(function(){
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
        this.globalMiddleware.sort(function(a, b){
          if(api.connections.middleware[a].priority > api.connections.middleware[b].priority){
            return 1;
          }else{
            return -1;
          }
        });
      }
    };

    var cleanConnection = function(connection){
      var clean = {};
      for(var i in connection){
        if(i !== 'rawConnection'){
          clean[i] = connection[i];
        }
      }
      return clean;
    };

    // {type: type, remotePort: remotePort, remoteIP: remoteIP, rawConnection: rawConnection}
    // id is optional and will be generated if missing
    api.connection = function(data){
      var self = this;
      self.setup(data);
      api.connections.connections[self.id] = self;

      api.connections.globalMiddleware.forEach(function(middlewareName){
        if(typeof api.connections.middleware[middlewareName].create === 'function'){
          api.connections.middleware[middlewareName].create(self);
        }
      });
    };

    api.connection.prototype.setup = function(data){
      var self = this;
      if(data.id){
        self.id = data.id;
      }else{
        self.id = self.generateID();
      }
      self.connectedAt = new Date().getTime();

      ['type', 'rawConnection'].forEach(function(req){
        if(data[req] === null || data[req] === undefined){ throw new Error(req + ' is required to create a new connection object'); }
        self[req] = data[req];
      });

      ['remotePort', 'remoteIP'].forEach(function(req){
        if(data[req] === null || data[req] === undefined){
          if(api.config.general.enforceConnectionProperties === true){
            throw new Error(req + ' is required to create a new connection object');
          }else{
            data[req] = 0; // could be a random uuid as well?
          }
        }
        self[req] = data[req];
      });

      var connectionDefaults = {
        error: null,
        fingerprint: self.id,
        rooms: [],
        params: {},
        pendingActions: 0,
        totalActions: 0,
        messageCount: 0,
        canChat: false
      };

      for(var i in connectionDefaults){
        if(self[i] === undefined && data[i] !== undefined){ self[i] = data[i]; }
        if(self[i] === undefined){ self[i] = connectionDefaults[i]; }
      }

      api.i18n.invokeConnectionLocale(self);
    };

    api.connection.prototype.localize = function(message){
      // this.locale will be sourced automatically
      return api.i18n.localize(message, this);
    };

    api.connection.prototype.generateID = function(){
      return uuid.v4();
    };

    api.connection.prototype.destroy = function(callback){
      var self = this;
      self.destroyed = true;

      api.connections.globalMiddleware.forEach(function(middlewareName){
        if(typeof api.connections.middleware[middlewareName].destroy === 'function'){
          api.connections.middleware[middlewareName].destroy(self);
        }
      });

      if(self.canChat === true){
        self.rooms.forEach(function(room){
          api.chatRoom.removeMember(self.id, room);
        });
      }
      var server = api.servers.servers[self.type];
      if(server){
        if(server.attributes.logExits === true){
          server.log('connection closed', 'info', {to: self.remoteIP});
        }
        if(typeof server.goodbye === 'function'){ server.goodbye(self); }
      }

      delete api.connections.connections[self.id];

      if(typeof callback === 'function'){ callback(); }
    };

    api.connection.prototype.set = function(key, value){
      var self = this;
      self[key] = value;
    };

    api.connection.prototype.verbs = function(verb, words, callback){
      var self = this;
      var key;
      var value;
      var room;
      var server = api.servers.servers[self.type];
      var allowedVerbs = server.attributes.verbs;
      if(typeof words === 'function' && !callback){
        callback = words;
        words = [];
      }
      if(!(words instanceof Array)){
        words = [words];
      }
      if(server && allowedVerbs.indexOf(verb) >= 0){
        server.log('verb', 'debug', {verb: verb, to: self.remoteIP, params: JSON.stringify(words)});
        if(verb === 'quit' || verb === 'exit'){
          server.goodbye(self);

        }else if(verb === 'paramAdd'){
          key = words[0];
          value = words[1];
          if((words[0]) && (words[0].indexOf('=') >= 0)){
            var parts = words[0].split('=');
            key = parts[0];
            value = parts[1];
          }
          if(api.config.general.disableParamScrubbing || api.params.postVariables.indexOf(key) > 0){
            self.params[key] = value;
          }
          if(typeof callback === 'function'){ callback(null, null); }
        }else if(verb === 'paramDelete'){
          key = words[0];
          delete self.params[key];
          if(typeof callback === 'function'){ callback(null, null); }

        }else if(verb === 'paramView'){
          key = words[0];
          if(typeof callback === 'function'){ callback(null, self.params[key]); }

        }else if(verb === 'paramsView'){
          if(typeof callback === 'function'){ callback(null, self.params); }

        }else if(verb === 'paramsDelete'){
          for(var i in self.params){
            delete self.params[i];
          }
          if(typeof callback === 'function'){ callback(null, null); }

        }else if(verb === 'roomAdd'){
          room = words[0];
          api.chatRoom.addMember(self.id, room, function(error, didHappen){
            if(typeof callback === 'function'){ callback(error, didHappen); }
          });

        }else if(verb === 'roomLeave'){
          room = words[0];
          api.chatRoom.removeMember(self.id, room, function(error, didHappen){
            if(typeof callback === 'function'){ callback(error, didHappen); }
          });

        }else if(verb === 'roomView'){
          room = words[0];
          if(self.rooms.indexOf(room) > -1){
            api.chatRoom.roomStatus(room, function(error, roomStatus){
              if(typeof callback === 'function'){ callback(error, roomStatus); }
            });
          }else{
            if(typeof callback === 'function'){ callback('not member of room ' + room); }
          }

        }else if(verb === 'detailsView'){
          var details            = {};
          details.id             = self.id;
          details.fingerprint    = self.fingerprint;
          details.remoteIP       = self.remoteIP;
          details.remotePort     = self.remotePort;
          details.params         = self.params;
          details.connectedAt    = self.connectedAt;
          details.rooms          = self.rooms;
          details.totalActions   = self.totalActions;
          details.pendingActions = self.pendingActions;
          if(typeof callback === 'function'){ callback(null, details); }

        }else if(verb === 'documentation'){
          if(typeof callback === 'function'){ callback(null, api.documentation.documentation); }

        }else if(verb === 'say'){
          room = words.shift();
          api.chatRoom.broadcast(self, room, words.join(' '), function(error){
            if(typeof callback === 'function'){ callback(error); }
          });

        }else{
          if(typeof callback === 'function'){ callback(api.config.errors.verbNotFound(self, verb), null); }
        }
      }else{
        if(typeof callback === 'function'){ callback(api.config.errors.verbNotAllowed(self, verb), null); }
      }
    };

    next();
  }
};
