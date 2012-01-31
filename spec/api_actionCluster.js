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

////////////////////////////////////////////////////////////////////////////
// cache and duplication

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
    'actionHero should be stopped - 0': function(resp){ specHelper.assert.equal(resp, true); } }
});

suite.addBatch({
  'actionCluster.stop - 2':{
    topic: function(){ specHelper.stopServer(2, this.callback); },
    'actionHero should be stopped - 0': function(resp){ specHelper.assert.equal(resp, true); } }
});

// export
suite.export(module);