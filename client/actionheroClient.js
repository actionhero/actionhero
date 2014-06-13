var actionheroClient = function(options, client){
  var self = this;

  self.callbacks = {};
  self.id = null;
  self.events = {};
  self.rooms = [];
  self.state = 'disconnected';

  self.options = self.defaults();
  for(var i in options){
    self.options[i] = options[i];
  }

  if(client != null){
    self.client = client;
  }
}

actionheroClient.prototype.defaults = function(){
  %%DEFAULTS%%
}

////////////////
// CONNECTION //
////////////////

actionheroClient.prototype.connect = function(callback){
  var self = this;
  
  if(self.client == null){
    self.client = Primus.connect(%%URL%%, self.options);
  }else{
    self.client.end();
    self.client.open();
  }

  self.client.on('open', function(){
    self.configure(function(details){
      self.emit('connected');
      if(self.state === 'connected'){
        //
      }else{
        self.state = 'connected';
        if(typeof callback === 'function'){ callback(null, details); }
      }
    });
  })

  self.client.on('reconnecting', function(){
    self.state = 'reconnecting';
    self.emit('disconnected');
  });

  self.client.on('end', function(){
    if(self.state !== 'disconnected'){
      self.state = 'disconnected';
      self.emit('disconnected');
    }
  });

  self.client.on('data', function(data){
    self.handleMessage(data);
  });
}

actionheroClient.prototype.configure = function(callback){
  var self = this;

  self.messageCount = 0;
  self.detailsView(function(details){
    self.id = details.data.id;
    if(self.rooms.length > 0){
      self.rooms.forEach(function(room){
        self.send({event: 'roomAdd', room: room});
      });
    }
    callback(details);
  }); 
}

///////////////
// MESSAGING //
///////////////

actionheroClient.prototype.send = function(args, callback){
  // primus will buffer messages when not connected
  var self = this;
  self.messageCount++;
  if(typeof callback === 'function'){
    self.callbacks[self.messageCount] = callback;
  }
  self.client.write(args);
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

actionheroClient.prototype.say = function(room, message, callback){
  this.send({event: 'say', room: room, message: message}, callback);
}

actionheroClient.prototype.file = function(file, callback){
  this.send({event: 'file', file: file}, callback);
}

actionheroClient.prototype.detailsView = function(callback){
  this.send({event: 'detailsView'}, callback);
}

actionheroClient.prototype.roomView = function(room, callback){
  this.send({event: 'roomView', room: room}, callback);
}

actionheroClient.prototype.roomAdd = function(room, callback){
  this.rooms.push(room); // only a list of *intended* rooms to join; might fail
  this.send({event: 'roomAdd', room: room}, callback);
}

actionheroClient.prototype.roomLeave = function(room, callback){
  this.send({event: 'roomLeave', room: room}, callback);
}

actionheroClient.prototype.documentation = function(callback){
  this.send({event: 'documentation'}, callback);
}

actionheroClient.prototype.disconnect = function(){
  this.state = 'disconnected';
  this.client.end();
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