(function(exports){

  var actionHeroWebSocket = function(options, callback){
    var self = this;
    if(callback == null && typeof options == 'function'){ callback = options; options = null; }

    self.callbacks = {};
    self.id = null;
    self.events = {};
    self.state = 'disconnected';

    self.options = self.defaults();
    for(var i in options){
      self.options[i] = options[i];
    }

    if(options && options.faye != null){
      self.faye = options.faye;
    } else if(window.Faye != null){
      self.faye = window.Faye;
    } else {
      self.faye = Faye;
    }
  }

  actionHeroWebSocket.prototype.defaults = function(){
    var host;
    if(typeof window != 'undefined'){ host = window.location.origin }
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
      if(typeof message != 'string'){ message = JSON.stringify(message) }
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
      if(typeof self.events.connect === 'disconnect'){
        self.events.disconnect('connected');
      }
    });

    self.client.on('transport:up', function(){
      var previousState = self.state;
      self.state = 'connected';
      self.setupConnection(function(details){
        if(previousState == 'reconnecting' && typeof self.events.reconnect === 'function'){
          self.events.reconnect('reconnected');
        } else {
          if(typeof self.events.connect === 'function'){
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
        if(self.room != null){
          self.send({event: 'roomChange', room: self.room});
        }
        self.id = details.data.id;
        callback(details);
      });
    },self.options.connectionDelay);
  }

  actionHeroWebSocket.prototype.completeConnect = function(details){
    var self = this;
    if(typeof self.startupCallback == 'function'){
      self.startupCallback(null, details);
    }
  }

  actionHeroWebSocket.prototype.send = function(args, callback){
    var self = this;
    if(self.state == 'connected'){
      self.messageCount++;
      if(typeof callback === 'function'){
        self.callbacks[self.messageCount] = callback;
      }
      self.client.publish(self.channel, args).errback(function(err){
        self.log(err);
      });
    } else if(typeof callback == 'function'){ callback({error: 'not connected', state: self.state}) }
  }

  actionHeroWebSocket.prototype.handleMessage = function(message){
    var self = this;
    if(message.context === 'response'){
      if(typeof self.callbacks[message.messageCount] === 'function'){
        self.callbacks[message.messageCount](message);
      }
      delete self.callbacks[message.messageCount];
    } else if(message.context === 'user'){
      if(typeof self.events.say === 'function'){
        self.events.say(message);
      }
    } else if(message.context === 'alert'){
      if(typeof self.events.api === 'function'){
        self.events.api(message);
      }
    } else if(message.welcome != null && message.context == 'api'){
      self.welcomeMessage = message.welcome;
      if(typeof self.events.say === 'function' && typeof self.events.welcome == 'function'){
        self.events.welcome(message);
      }
    } else if(message.context === 'api'){
      if(typeof self.events.api === 'function'){
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
    s[14] = '4';  // bits 12-15 of the time_hi_and_version field to 0010
    s[19] = hexDigits.substr((s[19] & 0x3) | 0x8, 1);  // bits 6-7 of the clock_seq_hi_and_reserved to 01
    s[8] = s[13] = s[18] = s[23] = '-';

    return s.join('');
  }

  actionHeroWebSocket.prototype.action = function(action, params, callback){
    if(callback == null && typeof params == 'function'){
      callback = params;
      params = null;
    }
    if(params == null){ params = {} }
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

})(typeof exports === 'undefined' ? window : exports);
