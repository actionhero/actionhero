(function(exports){

  var actionheroClient = function(options){
    var self = this;

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
      try{
        self.faye = Faye;
      }catch(e){
        self.faye = null;
      }
    }
  }

  actionheroClient.prototype.defaults = function(){
    var host;

    if(typeof window != 'undefined'){ host = window.location.origin }
    return {
      host:            host,
      fayePath:        '/faye',
      apiPath:         '/api',
      setupChannel:    '/client/websocket/_incoming/' + this.randomString(),
      channelPrefix:   '/client/websocket/connection/',
      connectionDelay:  200,
      timeout:          60 * 1000,
      retry:            10
    }
  }

  ////////////////
  // CONNECTION //
  ////////////////

  actionheroClient.prototype.connect = function(callback){
    var self = this;
    
    self.client = new self.faye.Client(self.options.host + self.options.fayePath, {
      retry: self.options.retry,
      timeout: self.options.timeout
    });
    // self.client.disable('websocket');

    self.setupSubscription = self.client.subscribe(self.options.setupChannel, function(message){
      self.id = message.id;
      self.channel = self.options.channelPrefix + self.id;
      self.setupSubscription.cancel();
      delete self.setupSubscription;

      self.subscription = self.client.subscribe(self.channel, function(message){
        self.handleMessage(message);
      });

      setTimeout(function(){
        self.detailsView(function(details){
          if(self.room != null){
            self.send({event: 'roomChange', room: self.room});
          }
          if(typeof callback === 'function'){ callback(null, details); }
        });
      }, self.options.connectionDelay);
    });


    self.client.on('transport:down', function(){
      self.state = 'reconnecting';
      self.emit('disconnected');
    });

    self.client.on('transport:up', function(){
      var previousState = self.state;
      self.state = 'connected';
      self.messageCount = 0;
      self.emit('connected');
      if(previousState === 'reconnecting'){
        self.detailsView(function(details){
          if(self.room != null){
            self.send({event: 'roomChange', room: self.room});
          }
        });
      }
    });
  }

  ///////////////
  // MESSAGING //
  ///////////////

  actionheroClient.prototype.send = function(args, callback){
    var self = this;
    if(self.state === 'connected'){
      self.messageCount++;
      if(typeof callback === 'function'){
        self.callbacks[self.messageCount] = callback;
      }
      self.client.publish(self.channel, args);
    } else if(typeof callback == 'function'){ 
      callback({error: 'not connected', state: self.state}) 
    }
  }

  actionheroClient.prototype.handleMessage = function(message){
    var self = this;
    self.emit('message', message);
    if(message.context === 'response'){
      if(typeof self.callbacks[message.messageCount] === 'function'){
        self.callbacks[message.messageCount](message);
      }
      delete self.callbacks[message.messageCount];
    } else if(message.context === 'user'){
      self.emit('say', message);
    } else if(message.context === 'alert'){
      self.emit('alert', message);
    } else if(message.welcome != null && message.context == 'api'){
      self.welcomeMessage = message.welcome;
      self.emit('welcome', message);
    } else if(message.context === 'api'){
      if(message.status === "ClientDisconnect"){
        self.disconnect();
      }
      self.emit('api', message);
    }
  }

  /////////////
  // ACTIONS //
  /////////////

  actionheroClient.prototype.action = function(action, params, callback){
    if(callback == null && typeof params == 'function'){
      callback = params;
      params = null;
    }
    if(params == null){ params = {} }
    params.action = action;
    
    if(this.state !== 'connected'){
      this.actionWeb(params, callback);
    }else{
      this.actionWebSocket(params, callback);
    }
  }

  actionheroClient.prototype.actionWeb = function(params, callback){
    var timeoutTimer = setTimeout(function(){
      callback('timeout');
    }, this.options.timeout);

    var xmlhttp = new XMLHttpRequest();
    xmlhttp.onreadystatechange = function(){
      if(xmlhttp.readyState == 4){
        clearTimeout(timeoutTimer);
        if(xmlhttp.status == 200){
          var response = JSON.parse(xmlhttp.responseText);
          callback(null, response);
        }else{
          callback(xmlhttp.statusText, xmlhttp.responseText);
        }
      }
    }
    var qs = "?"
    for(var i in params){
      qs += i + "=" + params[i] + "&";
    }
    var method = 'GET';
    if(params.httpMethod != null){
      method = params.httpMethod;
    }
    var url = this.options.host + this.options.apiPath + qs;
    xmlhttp.open(method, url, true);
    xmlhttp.send();
  }

  actionheroClient.prototype.actionWebSocket = function(params, callback){
    this.send({event: 'action',params: params}, callback);
  }

  //////////////
  // COMMANDS //
  //////////////

  actionheroClient.prototype.say = function(message, callback){
    this.send({event: 'say', message: message}, callback);
  }

  actionheroClient.prototype.file = function(file, callback){
    this.send({event: 'file', file: file}, callback);
  }

  actionheroClient.prototype.detailsView = function(callback){
    this.send({event: 'detailsView'}, callback);
  }

  actionheroClient.prototype.roomView = function(callback){
    this.send({event: 'roomView'}, callback);
  }

  actionheroClient.prototype.roomChange = function(room, callback){
    this.room = room;
    this.send({event: 'roomChange', room: room}, callback);
  }

  actionheroClient.prototype.roomLeave = function(callback){
    this.send({event: 'roomLeave'}, callback);
  }

  actionheroClient.prototype.listenToRoom = function(room, callback){
    this.send({event: 'listenToRoom', room: room}, callback);
  }

  actionheroClient.prototype.silenceRoom = function(room, callback){
    this.send({event: 'silenceRoom', room: room}, callback);
  }

  actionheroClient.prototype.documentation = function(callback){
    this.send({event: 'documentation'}, callback);
  }

  actionheroClient.prototype.disconnect = function(){
    this.state = 'disconnected';
    this.client.disconnect();
    this.emit('disconnected');
  }

  /////////////
  // HELPERS //
  /////////////

  actionheroClient.prototype.on = function(event, callback){
    var self = this;
    if(self.events[event] == null){
      self.events[event] = {};
    }
    var key = self.randomString();
    self.events[event][key] = callback;
    return key;
  }

  actionheroClient.prototype.emit = function(event, data){
    var self = this;
    if(self.events[event] != null){
      for(var i in self.events[event]){
        self.events[event][i](data);
      }
    }
  }

  actionheroClient.prototype.removeListener = function(event, key){
    var self = this;
    delete self.events[event][key];
  }

  actionheroClient.prototype.removeAllListeners = function(event){
    var self = this;
    delete self.events[event];
  }

  actionheroClient.prototype.randomString = function(){
    var seed = "";
    var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    for( var i=0; i < 32; i++ ){
      seed += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    seed += '-' + new Date().getTime();
    return seed
  }

  exports.actionheroClient = actionheroClient;

})(typeof exports === 'undefined' ? window : exports);