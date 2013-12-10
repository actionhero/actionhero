(function(exports){

  var actionHeroWebSocket = function(options, callback){
    var self = this;
    if(null === callback && 'function' === typeof options){ callback = options; options = null; }

    self.callbacks = {};
    self.id = null;
    self.events = {};
    self.state = 'disconnected';

    self.options = self.defaults();
    for(var i in options){
      self.options[i] = options[i];
    }

    if(options && null !== options.faye){
      self.faye = options.faye;
    } else if(null !== window.Faye){
      self.faye = window.Faye;
    } else {
      self.faye = Faye;
    }
  }

  actionHeroWebSocket.prototype.defaults = function(){
    var host;
    if('undefined' !== typeof window){ host = window.location.origin }
    return {
      host: host,
      path: '/faye',
      setupChannel: '/_welcome',
      channelPrefix: '/client/websocket/connection/',
      apiPath: '/api',
      connectionDelay: 500,
      timeout: 60,
      retry: 10
    }
  }

  actionHeroWebSocket.prototype.log = function(message){
    if(console && console.log){
      if('string' !== typeof message){ message = JSON.stringify(message) }
      var date = new Date();
      var times = [date.getHours().toString(), date.getMinutes().toString(), date.getSeconds().toString()];
      for(var i in times){
        if(times[i].length < 2){ times[i] = '0' + times[i]; }
      }
      console.log('[AH::client @ ' + times.join(':') + '] ' + message);
    }
  }

  actionHeroWebSocket.prototype.connect = function(callback){
    var self = this;
    
    self.startupCallback = callback;
    self.client = new self.faye.Client(self.options.host + self.options.path, {
      retry: self.options.retry,
      timeout: self.options.timeout
    });
    self.channel = self.options.channelPrefix + self.createUUID();

    self.subscription = self.client.subscribe(self.channel, function(message) {
      self.handleMessage(message);
    });

    // self.client.disable('websocket');

    self.client.on('transport:down', function(){
      self.state = 'reconnecting';
      if('disconnect' === typeof self.events.connect){
        self.events.disconnect('connected');
      }
    });

    self.client.on('transport:up', function(){
      var previousState = self.state;
      self.state = 'connected';
      self.setupConnection(function(details){
        if('reconnecting' === previousState && 'function' === typeof self.events.reconnect){
          self.events.reconnect('reconnected');
        } else {
          if('function' === typeof self.events.connect){
            self.events.connect('connected');
          }
          self.completeConnect(details);
        }
      });
    });
  }

  actionHeroWebSocket.prototype.setupConnection = function(callback){
    var self = this;
    self.messageCount = 0;

    setTimeout(function(){
      self.detailsView(function(details){
        if(null !== self.room){
          self.send({event: 'roomChange', room: self.room});
        }
        self.id = details.data.id;
        callback(details);
      });
    },self.options.connectionDelay);
  }

  actionHeroWebSocket.prototype.completeConnect = function(details){
    var self = this;
    if('function' === typeof self.startupCallback){
      self.startupCallback(null, details);
    }
  }

  actionHeroWebSocket.prototype.send = function(args, callback){
    var self = this;
    if('connected' === self.state){
      self.messageCount++;
      if('function' === typeof callback){
        self.callbacks[self.messageCount] = callback;
      }
      self.client.publish(self.channel, args).errback(function(err){
        self.log(err);
      });
    } else if('function' === typeof callback){ callback({error: 'not connected', state: self.state}) }
  }

  actionHeroWebSocket.prototype.handleMessage = function(message){
    var self = this;
    if('response' === message.context){
      if('function' === typeof self.callbacks[message.messageCount]){
        self.callbacks[message.messageCount](message);
      }
      delete self.callbacks[message.messageCount];
    } else if('user' === message.context){
      if('function' === typeof self.events.say){
        self.events.say(message);
      }
    } else if('alert' === message.context){
      if('function' === typeof self.events.api){
        self.events.api(message);
      }
    } else if(null !== message.welcome && 'api' === message.context){
      self.welcomeMessage = message.welcome;
      if('function' === typeof self.events.say && 'function' === typeof self.events.welcome){
        self.events.welcome(message);
      }
    } else if('api' === message.context){
      if('function' === typeof self.events.api){
        self.events.api(message);
      }
    }
  }

  actionHeroWebSocket.prototype.createUUID = function(){
    // http://www.ietf.org/rfc/rfc4122.txt
    var s = [];
    var hexDigits = '0123456789abcdef';
    for (var i = 0; i < 36; i++) {
      s[i] = hexDigits.substr(Math.floor(Math.random() * 0x10), 1);
    }
    // bits 12-15 of the time_hi_and_version field to 0010
    s[14] = '4';
    // bits 6-7 of the clock_seq_hi_and_reserved to 01
    s[19] = hexDigits.substr((s[19] & 0x3) | 0x8, 1);
    s[8] = s[13] = s[18] = s[23] = '-';

    return s.join('');
  }

  actionHeroWebSocket.prototype.action = function(action, params, callback){
    if(null === callback && 'function' === typeof params){
      callback = params;
      params = null;
    }
    if(null === params){ params = {} }
    params.action = action;
    this.send({
      event: 'action',
      params: params
    }, callback);
  }

  actionHeroWebSocket.prototype.say = function(message, callback){
    this.send({
      event: 'say',
      message: message
    }, callback);
  }

  actionHeroWebSocket.prototype.detailsView = function(callback){
    this.send({event: 'detailsView'}, callback);
  }

  actionHeroWebSocket.prototype.roomView = function(callback){
    this.send({event: 'roomView'}, callback);
  }

  actionHeroWebSocket.prototype.roomChange = function(room, callback){
    this.room = room;
    this.send({event: 'roomChange', room: room}, callback);
  }

  actionHeroWebSocket.prototype.roomLeave = function(callback){
    this.send({event: 'roomLeave'}, callback);
  }

  actionHeroWebSocket.prototype.listenToRoom = function(room, callback){
    this.send({event: 'listenToRoom', room: room}, callback);
  }

  actionHeroWebSocket.prototype.silenceRoom = function(room, callback){
    this.send({event: 'silenceRoom', room: room}, callback);
  }

  actionHeroWebSocket.prototype.documentation = function(callback){
    this.send({event: 'documentation'}, callback);
  }

  actionHeroWebSocket.prototype.disconnect = function(){
    this.state = 'disconnected';
    this.client.disconnect();
  }

  exports.actionHeroWebSocket = actionHeroWebSocket;

})('undefined' === typeof exports ? window : exports);
