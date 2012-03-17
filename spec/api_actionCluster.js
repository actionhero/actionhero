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
  'actionClusters should reconnect to eachother n\'at':{
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
	  var connectedSockets = {};
	  client1 = net.connect(specHelper.params[0].socketServerPort);
	  client1.setEncoding('utf8');
	  client1.on("data", function(){ connectedSockets[0] = true ;})
	  client2 = net.connect(specHelper.params[1].socketServerPort);
	  client2.setEncoding('utf8');
	  client2.on("data", function(){ connectedSockets[1] = true ;})
	  client3 = net.connect(specHelper.params[2].socketServerPort);
	  client3.setEncoding('utf8');	  
	  client3.on("data", function(){ connectedSockets[2] = true ;})
	  
	  function checkForSocketConnections(connectedSockets, expectedCount, cb){
	  	if(specHelper.utils.hashLength(connectedSockets) != expectedCount){
	  		setTimeout(checkForSocketConnections, 100, connectedSockets, expectedCount, cb)
	  	}else{
	  		setTimeout(cb, (apis[0].configData.actionCluster.ReConnectToLostPeersMS * 2));
	  	}
	  }
	  
	  checkForSocketConnections(connectedSockets, 3, cb);
    },
    'api object should exist': function(resp){ 
		specHelper.assert.isObject(client1); 
		specHelper.assert.isObject(client2); 
		specHelper.assert.isObject(client3); 
	}}
});

suite.addBatch({
	"all connections should be in the default room and other members should be seen": {
		topic: function(){ 
			makeSocketRequest(client1, this.callback, "roomView");
		}, 'should be a JSON response 1' : function(resp, d){
			specHelper.assert.isObject(d);
			specHelper.assert.equal("defaultRoom", d.room);
			specHelper.assert.equal(d.roomStatus.members.length, 3);
		}
	},
	"socket 2 connections should be able to connect and get JSON": {
		topic: function(){ 
			makeSocketRequest(client2, this.callback, "roomView");
		}, 'should be a JSON response 2' : function(resp, d){
			specHelper.assert.isObject(d);
			specHelper.assert.equal("defaultRoom", d.room);
			specHelper.assert.equal(d.roomStatus.members.length, 3);
		}
	},
	"socket 3 connections should be able to connect and get JSON": {
		topic: function(){ 
			makeSocketRequest(client3, this.callback, "roomView");
		}, 'should be a JSON response 3' : function(resp, d){
			specHelper.assert.isObject(d);
			specHelper.assert.equal("defaultRoom", d.room);
			specHelper.assert.equal(d.roomStatus.members.length, 3);
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

suite.addBatch({
  'I can save an object with parity of 2 (again)':{
    topic: function(){ 
		var cb = this.callback; 
		hostsWhichUsedCache = []; // reset
		apis[0].actionCluster.cache.save(apis[0], "test_key_again", "123", null, cb) 
	},
    'save resp (again)': function(a,b){ 
		specHelper.assert.equal(a.length,2);
		specHelper.assert.equal(a[0].value,true);
		specHelper.assert.equal(a[0].key,"test_key_again");
		specHelper.assert.equal(a[1].value,true);
		specHelper.assert.equal(a[1].key,"test_key_again");
		hostsWhichUsedCache.push(a[0].remotePeer);
		hostsWhichUsedCache.push(a[1].remotePeer);
	} }
});

suite.addBatch({
  'I can remove a cache entry for a single peer':{
    topic: function(){ 
		// turn off duplication
		for(var i in apis){
		  clearTimeout(apis[i].actionCluster.cache.duplicationTimer);
		}
		
		var cb = this.callback; 
		apis[0].actionCluster.cache.destroy(apis[0], "test_key_again", hostsWhichUsedCache[1].host + ":" + hostsWhichUsedCache[1].port, cb);
	},
    'save resp for single peer': function(a,b){ 
		specHelper.assert.equal(a[0].key, "test_key_again");
		specHelper.assert.equal(a[0].value, true);
	} }
});

suite.addBatch({
  'The entry removed above should now only be on one peer':{
    topic: function(){ 
		var cb = this.callback; 
		apis[0].actionCluster.cache.load(apis[0], "test_key_again", cb)
	},
    'load resp on one peer': function(a,b){ 
		specHelper.assert.equal(a.length,3);
		var numRecords = 0;
		for(var i in a){
			var r = a[i];
			specHelper.assert.equal(r.key,"test_key_again");
			if(r.value == "123"){
				numRecords++;
			}
		}
		specHelper.assert.equal(numRecords,1);
	} }
});


suite.addBatch({
  'The entry removed above should come back to this (or another) peer after waiting':{
    topic: function(){ 
		// turn duplication back on
	  	  for (var i in apis){
			  apis[i].actionCluster.cache.duplicationTimer = setTimeout(apis[i].actionCluster.cache.ensureObjectDuplication, apis[i].configData.actionCluster.remoteTimeoutWaitMS, apis[i]);
	  	  }
		
		var cb = this.callback; 
		setTimeout(function(){
			apis[0].actionCluster.cache.load(apis[0], "test_key_again", cb)
		}, apis[0].configData.actionCluster.remoteTimeoutWaitMS * 4)
	},
    'load resp afeter waiting to come back': function(a,b){ 
		specHelper.assert.equal(a.length,3);
		var numRecords = 0;
		for(var i in a){
			var r = a[i];
			specHelper.assert.equal(r.key,"test_key_again");
			if(r.value == "123"){
				numRecords++;
			}
		}
		specHelper.assert.equal(numRecords,2);
	} }
});

////////////////////////////////////////////////////////////////////////////
// Tests to ensure that tasks only fire the proper number of time for "all" and "any"
suite.addBatch({
  '_periodicTasks should have been reloaded and populated at reboot':{
    topic: function(){ 
		var cb = this.callback;
		var resp = [];
		apis[0].cache.load(apis[0], "_periodicTasks", function(_periodicTasks_a){
			resp[0] = _periodicTasks_a;
			apis[1].cache.load(apis[1], "_periodicTasks", function(_periodicTasks_b){
				resp[1] = _periodicTasks_b;
				apis[2].cache.load(apis[2], "_periodicTasks", function(_periodicTasks_c){
					resp[2] = _periodicTasks_c;
					cb(resp);
				});
			});
		});
	},
    'should have data in all servers': function(resp, err){ 
		for (var i in resp){
			specHelper.assert.deepEqual(resp[i],[
				'caclculateStats',
				'cleanLogFiles',
				'cleanOldCacheObjects',
				'pingSocketClients',
				'saveCacheToDisk'	
			]);
		}
	} }
});

function removePeriodicTasks(cb){
	var resp = [];
	apis[0].cache.save(apis[0], "_periodicTasks", [], 100000, function(_periodicTasks_a){
		resp[0] = _periodicTasks_a;
		apis[1].cache.save(apis[1], "_periodicTasks", [], 100000, function(_periodicTasks_b){
			resp[1] = _periodicTasks_b;
			apis[2].cache.save(apis[2], "_periodicTasks", [], 100000, function(_periodicTasks_c){
				resp[2] = _periodicTasks_c;
				cb(resp);
			});
		});
	});
}

suite.addBatch({
  'I can remove all existing tasks (will help with testing)':{
    topic: function(){ 
		var cb = this.callback;
		removePeriodicTasks(cb)
	},
    'should have been deleted': function(resp, err){ 
		for (var i in resp){
			specHelper.assert.deepEqual(resp[i],true);
		}
	} }
});

suite.addBatch({
  'I can add new tasks to the api':{
    topic: function(){ 
		var cb = this.callback;
		var resp = [];
		
		var all_task = {
			name: "all_task",
			description: "I will add a line to a file",
			scope: "all",
			frequency: 1000,
			run: function(api, params, next){
				console.log("RUNNING ALL TASK @ "+api.configData.webServerPort);
				try{
					var file = "./cache/all_task.log";
					var fs = api.fs.createWriteStream(file, {flags:"a"})
					data = api.configData.webServerPort + " @ all_task" + "\r\n";
					fs.write(data);
					fs.end();
					next(true, null);
				}catch(e){
					console.log("Error writing to file: " + e);
					next(true, null);
				}
			}
		};

		var any_task = {
			name: "any_task",
			description: "I will add a line to a file",
			scope: "any",
			frequency: 1000,
			run: function(api, params, next){
				console.log("RUNNING ANY TASK @ "+api.configData.webServerPort);
				try{
					var file = "./cache/any_task.log";
					var fs = api.fs.createWriteStream(file, {flags:"a"})
					data = api.configData.webServerPort + " @ any_task" + "\r\n";
					fs.write(data);
					fs.end();
					next(true, null);
				}catch(e){
					console.log("Error writing to file: " + e);
					next(true, null);
				}
			}
		};
		
		var exists = apis[0].fs.existsSync("./cache/all_task.log");
		if(exists){ apis[0].fs.unlinkSync("./cache/all_task.log"); }
		var exists = apis[0].fs.existsSync("./cache/any_task.log");
		if(exists){ apis[0].fs.unlinkSync("./cache/any_task.log"); }
		
		for (var i in apis){
			apis[i].tasks.tasks["all_task"] = all_task;
			apis[i].tasks.tasks["any_task"] = any_task;
		}
		
		setTimeout(cb,1)
	},
    'new tasks added': function(resp, err){ 
		for (var i in apis){
			specHelper.assert.isObject(apis[i].tasks.tasks["all_task"]);
			specHelper.assert.isObject(apis[i].tasks.tasks["any_task"]);
		}
	},
    'timers should be on': function(resp, err){ 
		for (var i in apis){
			specHelper.assert.equal(apis[i].actionCluster.cache.duplicationTimer._idleTimeout, 1000)
		}
	}}
});

suite.addBatch({
  'The ALL tasks should happen on all servers':{
    topic: function(){ 
		var cb = this.callback;
		apis[0].tasks.enqueue(apis[0], "all_task", null);
		apis[1].tasks.enqueue(apis[1], "all_task", null);
		apis[2].tasks.enqueue(apis[2], "all_task", null);
		setTimeout(cb, 10000);
	},
    'check the file...': function(resp){ 
		var lines = apis[0].fs.readFileSync("./cache/all_task.log").toString().split("\n");
		console.log(lines);
	}}
});

suite.addBatch({
  'I can remove all existing tasks (CLER ALL)':{
    topic: function(){ 
		var cb = this.callback;
		removePeriodicTasks(cb)
	},
    'should have been deleted': function(resp, err){ 
		for (var i in resp){
			specHelper.assert.deepEqual(resp[i],true);
		}
	} }
});

suite.addBatch({
  'I can remove all existing tasks (CLER ANY)':{
    topic: function(){ 
		var cb = this.callback;
		removePeriodicTasks(cb)
	},
    'should have been deleted': function(resp, err){ 
		for (var i in resp){
			specHelper.assert.deepEqual(resp[i],true);
		}
	} }
});


suite.addBatch({
  'delete the test files when done':{
    topic: function(){ var cb = this.callback; setTimeout(cb, 1) },
    'done!': function(resp){ 
		var exists = apis[0].fs.existsSync("./cache/all_task.log");
		if(exists){ apis[0].fs.unlinkSync("./cache/all_task.log"); }
		var exists = apis[0].fs.existsSync("./cache/any_task.log");
		if(exists){ apis[0].fs.unlinkSync("./cache/any_task.log"); }
	}
}});

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