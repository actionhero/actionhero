var specHelper = require('../helpers/_specHelper.js').specHelper;
var suite = specHelper.vows.describe('API actionCluster');
var apis = [];
var timeoutToWaitForFirstServerStart = 100;

////////////////////////////////////////////////////////////////////////////
// Basic setup and joining cluster
suite.addBatch({
  'actionCluster.prepare - 0':{
    topic: function(){ 
		var cb = this.callback; specHelper.prepare(0, function(api){ 
			apis[0] = api; 
			setTimeout(cb, timeoutToWaitForFirstServerStart);
	}) },
    'api object should exist - 0': function(){ 
    	specHelper.assert.isObject(apis[0]); 
    } }
});

suite.addBatch({
  'actionCluster.prepare - 1':{
    topic: function(){ 
		var cb = this.callback; specHelper.prepare(1, function(api){ 
			apis[1] = api; 
			setTimeout(cb, timeoutToWaitForFirstServerStart);
	}) },
    'api object should exist - 1': function(){
    	specHelper.assert.isObject(apis[1]); 
    } }
});

suite.addBatch({
  'actionCluster.prepare - 2':{
    topic: function(){ 
		var cb = this.callback; specHelper.prepare(2, function(api){ 
			apis[2] = api;
			setTimeout(cb, timeoutToWaitForFirstServerStart);
	}) },
    'api object should exist - 2': function(){ 
    	specHelper.assert.isObject(apis[2]); 
    } }
});

suite.addBatch({
  'api inspection':{
    topic: apis,
    'check for defaults': function(apis){ 
		specHelper.assert.equal(apis[0].id, externalIP + ":9000:8000"); 
		specHelper.assert.equal(apis[1].id, externalIP + ":9001:8001"); 
		specHelper.assert.equal(apis[2].id, externalIP + ":9002:8002"); 
	} }
});

var externalIP = specHelper.utils.getExternalIPAddress();
suite.addBatch({
  'actionClusters should be aware of other members (peer 1 )':{
    topic: function(){ 
    	var cb = this.callback; 
    	apis[0].redis.client.llen("actionHero::peers", function(err, length){
			apis[0].redis.client.lrange("actionHero::peers", 0, length, function(err, peers){
				cb(peers)
			});
		});
    },
    'peers should be there': function(peers, err){ 
		specHelper.assert.equal(peers.length, 3);
		specHelper.assert.include([ externalIP+":9000:8000",  externalIP+":9001:8001",  externalIP+":9002:8002" ], peers[0]);
		specHelper.assert.include([ externalIP+":9000:8000",  externalIP+":9001:8001",  externalIP+":9002:8002" ], peers[1]);
		specHelper.assert.include([ externalIP+":9000:8000",  externalIP+":9001:8001",  externalIP+":9002:8002" ], peers[2]);
	} }
});
suite.addBatch({
  'actionClusters should be aware of other members (peer 2 )':{
    topic: function(){ 
    	var cb = this.callback; 
    	apis[1].redis.client.llen("actionHero::peers", function(err, length){
			apis[1].redis.client.lrange("actionHero::peers", 0, length, function(err, peers){
				cb(peers)
			});
		});
    },
    'peers should be there': function(peers, err){ 
		specHelper.assert.equal(peers.length, 3);
		specHelper.assert.include([ externalIP+":9000:8000",  externalIP+":9001:8001",  externalIP+":9002:8002" ], peers[0]);
		specHelper.assert.include([ externalIP+":9000:8000",  externalIP+":9001:8001",  externalIP+":9002:8002" ], peers[1]);
		specHelper.assert.include([ externalIP+":9000:8000",  externalIP+":9001:8001",  externalIP+":9002:8002" ], peers[2]);
	} }
});
suite.addBatch({
  'actionClusters should be aware of other members (peer 3 )':{
    topic: function(){ 
    	var cb = this.callback; 
    	apis[2].redis.client.llen("actionHero::peers", function(err, length){
			apis[2].redis.client.lrange("actionHero::peers", 0, length, function(err, peers){
				cb(peers)
			});
		});
    },
    'peers should be there': function(peers, err){ 
		specHelper.assert.equal(peers.length, 3);
		specHelper.assert.include([ externalIP+":9000:8000",  externalIP+":9001:8001",  externalIP+":9002:8002" ], peers[0]);
		specHelper.assert.include([ externalIP+":9000:8000",  externalIP+":9001:8001",  externalIP+":9002:8002" ], peers[1]);
		specHelper.assert.include([ externalIP+":9000:8000",  externalIP+":9001:8001",  externalIP+":9002:8002" ], peers[2]);
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
  'actionClusters should only have one entry... me!':{
    topic: function(){ 
    	var cb = this.callback; 
    	apis[0].redis.client.llen("actionHero::peers", function(err, length){
			apis[0].redis.client.lrange("actionHero::peers", 0, length, function(err, peers){
				cb(peers)
			});
		});
    },
    'peers should be there': function(peers, err){ 
		specHelper.assert.equal(peers.length, 1);
		specHelper.assert.include([ externalIP+":9000:8000",  externalIP+":9001:8001",  externalIP+":9002:8002" ], peers[0]);
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
  'actionClusters should all be back again':{
    topic: function(){ 
    	var cb = this.callback; 
    	apis[0].redis.client.llen("actionHero::peers", function(err, length){
			apis[0].redis.client.lrange("actionHero::peers", 0, length, function(err, peers){
				cb(peers)
			});
		});
    },
    'peers should be there': function(peers, err){ 
		specHelper.assert.equal(peers.length, 3);
		specHelper.assert.include([ externalIP+":9000:8000",  externalIP+":9001:8001",  externalIP+":9002:8002" ], peers[0]);
		specHelper.assert.include([ externalIP+":9000:8000",  externalIP+":9001:8001",  externalIP+":9002:8002" ], peers[1]);
		specHelper.assert.include([ externalIP+":9000:8000",  externalIP+":9001:8001",  externalIP+":9002:8002" ], peers[2]);
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
	  client1 = net.connect(specHelper.params[0].tcpServer.port);
	  client1.setEncoding('utf8');
	  client1.on("data", function(){ connectedSockets[0] = true ;})
	  client2 = net.connect(specHelper.params[1].tcpServer.port);
	  client2.setEncoding('utf8');
	  client2.on("data", function(){ connectedSockets[1] = true ;})
	  client3 = net.connect(specHelper.params[2].tcpServer.port);
	  client3.setEncoding('utf8');	  
	  client3.on("data", function(){ connectedSockets[2] = true ;})
	  
	  function checkForSocketConnections(connectedSockets, expectedCount, cb){
	  	if(specHelper.utils.hashLength(connectedSockets) != expectedCount){
	  		setTimeout(checkForSocketConnections, 100, connectedSockets, expectedCount, cb)
	  	}else{
	  		setTimeout(cb, (500));
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
			specHelper.assert.equal(d.roomStatus.members.length >= 3, true);
		}
	},
	"socket 2 connections should be able to connect and get JSON": {
		topic: function(){ 
			makeSocketRequest(client2, this.callback, "roomView");
		}, 'should be a JSON response 2' : function(resp, d){
			specHelper.assert.isObject(d);
			specHelper.assert.equal("defaultRoom", d.room);
			specHelper.assert.equal(d.roomStatus.members.length >= 3, true);
		}
	},
	"socket 3 connections should be able to connect and get JSON": {
		topic: function(){ 
			makeSocketRequest(client3, this.callback, "roomView");
		}, 'should be a JSON response 3' : function(resp, d){
			specHelper.assert.isObject(d);
			specHelper.assert.equal("defaultRoom", d.room);
			specHelper.assert.equal(d.roomStatus.members.length >= 3, true);
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
// shared cache

suite.addBatch({
	"one peer saves something, the others can read it": {
		topic: function(){ 
			var cb = this.callback;
			apis[0].cache.save(apis[0], "test_key", "yay", 3600, function(save_resp){
				apis[1].cache.load(apis[1], "test_key", function(value){
					cb(value)
				})
			});
		}, 'should be readable' : function(resp, err){
			specHelper.assert.equal(resp, "yay");
		}
	},
});

suite.addBatch({
	"and lets have the third peer delete it for measure": {
		topic: function(){ 
			var cb = this.callback;
			apis[2].cache.destroy(apis[2], "test_key", function(del_resp){
				cb(del_resp)
			});
		}, 'should be gone' : function(err, del_resp){
			specHelper.assert.equal(del_resp, true);
		}
	},
});

// ////////////////////////////////////////////////////////////////////////////
// // Tests to ensure that tasks only fire the proper number of time for "all" and "any"

// // TODO: THIS.

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