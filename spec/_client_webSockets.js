var specHelper = require('../helpers/_specHelper.js').specHelper;
var suite = specHelper.vows.describe('API websockets');
var io = require('socket.io-client');
var apiObj = {};

var socketURL = "http://localhost:9000";
var io_options ={
  transports: ['websocket'],
  'force new connection': true
};
var client_1 = {};
var client_2 = {};

function makeSocketRequest(thisClient, cb, type, data){
  var rsp = function(d){ 
    thisClient.removeListener('response', rsp); 
    cb(true, d); 
  };
  thisClient.on('response', rsp);
  thisClient.emit(type, data);
}

suite.addBatch({
  'specHelper.prepare':{
    topic: function(){
      var cb = this.callback;
      specHelper.prepare(0, function(api){
        apiObj = specHelper.cleanAPIObject(api);
        cb();
      })
    },
    'api object should exist': function(){ specHelper.assert.isObject(apiObj); },
  }
});

suite.addBatch({
  'socket client connections should work: client 1':{
    topic: function(){
      var cb = this.callback;
      client_1 = io.connect(socketURL, io_options);
      client_1.on('welcome', function(data){
        cb(false, data);
      });
    },
    'client should exist': function(err, data){ 
      specHelper.assert.isObject(data); 
      specHelper.assert.equal(data.context, "api")
      specHelper.assert.equal(data.room, "defaultRoom")
    },
  }
});

suite.addBatch({
  'socket client connections should work: client 2':{
    topic: function(){
      var cb = this.callback;
      client_2 = io.connect(socketURL, io_options);
      client_2.on('welcome', function(data){
        cb(false, data);
      });
    },
    'client 2 should exist': function(err, data){ 
      specHelper.assert.isObject(data); 
      specHelper.assert.equal(data.context, "api")
      specHelper.assert.equal(data.room, "defaultRoom")
    },
  }
});

suite.addBatch({
  'I can get my connection details':{
    topic: function(){
      var cb = this.callback;
      makeSocketRequest(client_1, cb, "detailsView");
    },
    'details?': function(err, data){ 
      specHelper.assert.isObject(data); 
      specHelper.assert.equal(data.status, "OK")
      specHelper.assert.equal(data.details.public.connectedAt > 0, true)
      specHelper.assert.equal(data.details.room, "defaultRoom")
    },
  }
});

suite.addBatch({
  'Clients can talk to each other':{
    topic: function(){
      var cb = this.callback;
      var rsp = function(d){ 
        client_1.removeListener('say', rsp); 
        cb(true, d); 
      };
      client_1.on('say', rsp);
      client_2.emit("say", {message: "hello from client 2"});
    },
    'say?': function(err, data){ 
      specHelper.assert.isObject(data); 
      specHelper.assert.equal(data.context, "user");
      specHelper.assert.equal(data.message, "hello from client 2");
    },
  }
});

suite.addBatch({
  'I can run an action with errors':{
    topic: function(){
      var cb = this.callback;
      makeSocketRequest(client_1, cb, "action", {action: "cacheTest"});
    },
    'failing action?': function(err, data){ 
      specHelper.assert.isObject(data); 
      specHelper.assert.equal(data.error, "key is a required parameter for this action");
    },
  }
});

suite.addBatch({
  'I can run an action without errors':{
    topic: function(){
      var cb = this.callback;
      makeSocketRequest(client_1, cb, "action", {action: "cacheTest", key: "test key", value: "test value"});
    },
    'happy action?': function(err, data){ 
      specHelper.assert.isObject(data); 
      specHelper.assert.equal(data.error, false);
    },
  }
});

suite.addBatch({
  'I can change my room':{
    topic: function(){
      var cb = this.callback;
      client_1.emit("roomChange", {room: "otherRoom"});
      makeSocketRequest(client_1, cb, "roomView");
    },
    'change?': function(err, data){ 
      specHelper.assert.isObject(data); 
      specHelper.assert.equal(data.status, "OK");
      specHelper.assert.equal(data.room, "otherRoom");
    },
  }
});

// export
suite.export(module);