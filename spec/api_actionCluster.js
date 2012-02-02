var specHelper = require('../_specHelper.js').specHelper;
var suite = specHelper.vows.describe('api: actionCluster');
var apis = [];
var timeoutToWaitForFirstServerStart = 1;

////////////////////////////////////////////////////////////////////////////
// Basic setup and joining cluster
suite.addBatch({
  'actionCluster.prepare - 0':{
    topic: function(){ 
		var cb = this.callback; specHelper.prepare(0, function(api){ 
		apis[0] = api; 
		setTimeout(cb, timeoutToWaitForFirstServerStart);
	}) },
    'api object should exist - 0': function(){ specHelper.assert.isObject(apis[0]); } }
});

suite.addBatch({
  'actionCluster.prepare - 1':{
    topic: function(){ 
		var cb = this.callback; specHelper.prepare(1, function(api){ 
		apis[1] = api; 
		setTimeout(cb, timeoutToWaitForFirstServerStart);
	}) },
    'api object should exist - 1': function(){ specHelper.assert.isObject(apis[1]); } }
});

suite.addBatch({
  'actionCluster.prepare - 2':{
    topic: function(){ 
		var cb = this.callback; specHelper.prepare(2, function(api){ 
		apis[2] = api;
		setTimeout(cb, timeoutToWaitForFirstServerStart);
	}) },
    'api object should exist - 2': function(){ specHelper.assert.isObject(apis[2]); } }
});

suite.addBatch({
  'api inspection':{
    topic: apis,
    'check for defaults': function(apis){ 
		specHelper.assert.equal(apis[0].configData.webServerPort, 9000); 
		specHelper.assert.equal(apis[1].configData.webServerPort, 9001); 
		specHelper.assert.equal(apis[2].configData.webServerPort, 9002); 
		
		specHelper.assert.equal(apis[0].configData.socketServerPort, 6000); 
		specHelper.assert.equal(apis[1].configData.socketServerPort, 6001); 
		specHelper.assert.equal(apis[2].configData.socketServerPort, 6002); 
	} }
});

suite.addBatch({
  'actionClusters should auto-discover peers (myself and my peers)':{
    topic: function(){ var cb = this.callback; setTimeout(cb, (apis[0].configData.actionCluster.ReConnectToLostPeersMS * 2)); },
    'pause it over': function(){ 
		for (var i = 0; i<=2; i++){
			specHelper.assert.equal(apis[i].actionCluster.peers["127.0.0.1:6000"], "connected");
			specHelper.assert.equal(apis[i].actionCluster.peers["127.0.0.1:6001"], "connected");
			specHelper.assert.equal(apis[i].actionCluster.peers["127.0.0.1:6002"], "connected");
		}
	} }
});


suite.addBatch({
  'actionClusters should have called into new peers':{
    topic: function(){ this.callback(); },
    'pause it over': function(){ 
		for (var i = 0; i<=2; i++){
			for (var j = 0; j<=2; j++){
				specHelper.assert.equal(apis[i].actionCluster.connectionsToPeers[j].remotePeer.host, "127.0.0.1");
				specHelper.assert.include([6000, 6001, 6002], apis[i].actionCluster.connectionsToPeers[j].remotePeer.port);
			}
		}
	} }
});

////////////////////////////////////////////////////////////////////////////
// reconnecting

suite.addBatch({
  'actionCluster.stopForReconnect - 2':{
    topic: function(){ specHelper.stopServer(2, this.callback); },
    'actionHero should be stopped - 0': function(resp){ specHelper.assert.equal(resp, true); } }
});

suite.addBatch({
  'actionCluster.stopForReconnect - 1':{
    topic: function(){ specHelper.stopServer(1, this.callback); },
    'actionHero should be stopped - 1': function(resp){ specHelper.assert.equal(resp, true); } }
});

suite.addBatch({
  'actionClusters should note lost peers as disconnected':{
    topic: function(){ var cb = this.callback; setTimeout(cb, (apis[0].configData.actionCluster.ReConnectToLostPeersMS * 2)); },
    'pause it over': function(){ 
		specHelper.assert.equal(apis[1].actionCluster.peers["127.0.0.1:6000"], "connected");
		specHelper.assert.equal(apis[1].actionCluster.peers["127.0.0.1:6001"], "disconnected"); //self
		specHelper.assert.equal(apis[1].actionCluster.peers["127.0.0.1:6002"], "disconnected");
	} }
});

suite.addBatch({
  'actionCluster.reStartForReconnect - 2':{
    topic: function(){ specHelper.restartServer(2, this.callback); },
    'actionHero should be restarted - 2': function(resp){ specHelper.assert.equal(resp, true); } }
});

suite.addBatch({
  'actionCluster.reStartForReconnect - 1':{
    topic: function(){ specHelper.restartServer(1, this.callback); },
    'actionHero should be restarted - 1': function(resp){ specHelper.assert.equal(resp, true); } }
});

suite.addBatch({
  'actionClusters should reconnect to eachother nAt':{
    topic: function(){ var cb = this.callback; setTimeout(cb, (apis[0].configData.actionCluster.ReConnectToLostPeersMS * 2)); },
    'pause it over': function(){ 
		for (var i = 0; i<=2; i++){
			specHelper.assert.equal(apis[i].actionCluster.peers["127.0.0.1:6000"], "connected");
			specHelper.assert.equal(apis[i].actionCluster.peers["127.0.0.1:6001"], "connected");
			specHelper.assert.equal(apis[i].actionCluster.peers["127.0.0.1:6002"], "connected");
		}
	} }
});

////////////////////////////////////////////////////////////////////////////
// say and rooms

var net = require('net');

var client1 = {};
var client2 = {};
var client3 = {};

function makeSocketRequest(thisClient, cb, message){
	var rsp = function(d){ 
		parsed = JSON.parse(d);
		thisClient.removeListener('data', rsp); 
		cb(true, parsed); 
	};
	thisClient.on('data', rsp);
	thisClient.write(message + "\r\n");
}

suite.addBatch({
  'specHelper.prepare.socketClients':{
    topic: function(){
      var cb = this.callback;
	  client1 = net.connect(specHelper.params[0].socketServerPort, function(){
		  client1.setEncoding('utf8');
		  client2 = net.connect(specHelper.params[1].socketServerPort, function(){
			  client2.setEncoding('utf8');
			  client3 = net.connect(specHelper.params[2].socketServerPort, function(){
				  client3.setEncoding('utf8');
				  setTimeout(cb, 1000);
			  }); 
		  }); 
	  });
    },
    'api object should exist': function(){ 
		specHelper.assert.isObject(client1); 
		specHelper.assert.isObject(client2); 
		specHelper.assert.isObject(client3); 
	},
  }
});

suite.addBatch({
	"all connections should be in the default room and other members should be seen": {
		topic: function(){ 
			makeSocketRequest(client1, this.callback, "roomView");
		}, 'should be a JSON response 1' : function(resp, d){
			specHelper.assert.isObject(d);
			specHelper.assert.equal("defaultRoom", d.room);
			specHelper.assert.equal(3, d.roomStatus.members.length);
		}
	},
	"socket 2 connections should be able to connect and get JSON": {
		topic: function(){ 
			makeSocketRequest(client2, this.callback, "roomView");
		}, 'should be a JSON response 2' : function(resp, d){
			specHelper.assert.isObject(d);
			specHelper.assert.equal("defaultRoom", d.room);
			specHelper.assert.equal(3, d.roomStatus.members.length);
		}
	},
	"socket 3 connections should be able to connect and get JSON": {
		topic: function(){ 
			makeSocketRequest(client3, this.callback, "roomView");
		}, 'should be a JSON response 3' : function(resp, d){
			specHelper.assert.isObject(d);
			specHelper.assert.equal("defaultRoom", d.room);
			specHelper.assert.equal(3, d.roomStatus.members.length);
		}
	}	
});

suite.addBatch({
	"one guy says something, the other should hear it": {
		topic: function(){ 
			makeSocketRequest(client2, this.callback, "");
			client1.write("say Hi there!" + "\r\n");
		}, 'say should work across peers' : function(resp, d){
			specHelper.assert.isObject(d);
			specHelper.assert.equal("Hi there!", d.message);
			specHelper.assert.equal("user", d.context);
		}
	},
});


////////////////////////////////////////////////////////////////////////////
// cache and duplication

var hostsWhichUsedCache = [];
suite.addBatch({
  'I can save an object with parity of 2':{
    topic: function(){ var cb = this.callback; apis[0].actionCluster.cache.save(apis[0], "test_key", "123", null, cb) },
    'save resp': function(a,b){ 
		specHelper.assert.equal(a.length,2);
		specHelper.assert.equal(a[0].value,true);
		specHelper.assert.equal(a[0].key,"test_key");
		specHelper.assert.equal(a[1].value,true);
		specHelper.assert.equal(a[1].key,"test_key");
		hostsWhichUsedCache.push(a[0].remotePeer);
		hostsWhichUsedCache.push(a[1].remotePeer);
	} }
});

suite.addBatch({
  'I can retrieve objects, even from nodes which do not have the data':{
    topic: function(){ var cb = this.callback; apis[0].actionCluster.cache.load(apis[0], "test_key", cb) },
    'load resp': function(a,b){ 
		specHelper.assert.equal(a.length,3);
		for(var i in a){
			var r = a[i];
			specHelper.assert.equal(r.key,"test_key");
			if(r.remotePeer.port == hostsWhichUsedCache[0].port || r.remotePeer.port == hostsWhichUsedCache[1].port){
				specHelper.assert.equal(r.value,"123");
				specHelper.assert.equal(r.expireTimestamp > 1, true);
				specHelper.assert.equal(r.createdAt > 1, true);
				specHelper.assert.equal(r.readAt > 1, true);
			}else{
				specHelper.assert.isNull(r.value);
				specHelper.assert.isNull(r.expireTimestamp);
				specHelper.assert.isNull(r.createdAt);
				specHelper.assert.isNull(r.readAt);
			}
		}
	} }
});

var hostsWhichUsedCache = [];
suite.addBatch({
  'I can delete the object on all peers':{
    topic: function(){ var cb = this.callback; apis[0].actionCluster.cache.destroy(apis[0], "test_key", cb) },
    'delete resp': function(a,b){ 
		specHelper.assert.equal(a.length,3);
		for(var i in a){
			var r = a[i];
			specHelper.assert.equal(r.key,"test_key");
			if(r.remotePeer.port == hostsWhichUsedCache[0].port || r.remotePeer.port == hostsWhichUsedCache[1].port){
				specHelper.assert.equal(r.value,true);
			}else{
				specHelper.assert.equal(r.value,false);
			}
		}
	} }
});

suite.addBatch({
  'Loading data from peers after deletion will make nulls happen':{
    topic: function(){ var cb = this.callback; apis[0].actionCluster.cache.load(apis[0], "test_key", cb) },
    'load resp': function(a,b){ 
		specHelper.assert.equal(a.length,3);
		for(var i in a){
			var r = a[i];
			specHelper.assert.equal(r.key,"test_key");
			specHelper.assert.isNull(r.value);
			specHelper.assert.isNull(r.expireTimestamp);
			specHelper.assert.isNull(r.createdAt);
			specHelper.assert.isNull(r.readAt);
		}
	} }
});

////////////////////////////////////////////////////////////////////////////
// stop the servers when done so the other tests can use a single instance
suite.addBatch({
  'actionCluster.stop - 0':{
    topic: function(){ specHelper.stopServer(0, this.callback); },
    'actionHero should be stopped - 0': function(resp){ specHelper.assert.equal(resp, true); } }
});

suite.addBatch({
  'actionCluster.stop - 1':{
    topic: function(){ specHelper.stopServer(1, this.callback); },
    'actionHero should be stopped - 1': function(resp){ specHelper.assert.equal(resp, true); } }
});

suite.addBatch({
  'actionCluster.stop - 2':{
    topic: function(){ specHelper.stopServer(2, this.callback); },
    'actionHero should be stopped - 2': function(resp){ specHelper.assert.equal(resp, true); } }
});

// export
suite.export(module);