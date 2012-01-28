var specHelper = require('../_specHelper.js').specHelper;
var suite = specHelper.vows.describe('api: actionCluster');
var apis = [];
var timeoutToWaitForFirstServerStart = 1;

// suite.addBatch({
//   'actionCluster.prepare - 0':{
//     topic: function(){ 
// 		var cb = this.callback; specHelper.prepare(0, function(api){ 
// 		apis[0] = specHelper.cleanAPIObject(api); 
// 		setTimeout(cb, timeoutToWaitForFirstServerStart);
// 	}) },
//     'api object should exist - 0': function(){ specHelper.assert.isObject(apis[0]); } }
// });
// 
// suite.addBatch({
//   'actionCluster.prepare - 1':{
//     topic: function(){ 
// 		var cb = this.callback; specHelper.prepare(1, function(api){ 
// 		apis[1] = specHelper.cleanAPIObject(api); 
// 		setTimeout(cb, timeoutToWaitForFirstServerStart);
// 	}) },
//     'api object should exist - 1': function(){ specHelper.assert.isObject(apis[1]); } }
// });
// 
// suite.addBatch({
//   'actionCluster.prepare - 2':{
//     topic: function(){ 
// 		var cb = this.callback; specHelper.prepare(2, function(api){ 
// 		apis[2] = specHelper.cleanAPIObject(api);
// 		setTimeout(cb, timeoutToWaitForFirstServerStart);
// 	}) },
//     'api object should exist - 2': function(){ specHelper.assert.isObject(apis[2]); } }
// });
// 
// suite.addBatch({
//   'api inspection':{
//     topic: apis,
//     'pause it over': function(apis){ 
// 		specHelper.assert.equal(apis[0].configData.webServerPort, 9000); 
// 		specHelper.assert.equal(apis[1].configData.webServerPort, 9001); 
// 		specHelper.assert.equal(apis[2].configData.webServerPort, 9002); 
// 	} }
// });


// STOP THE SERVER!

// suite.addBatch({
//   'actionCluster.pause for catch-up':{
//     topic: function(){ var cb = this.callback; setTimeout(cb, 1000, "hello") },
//     'pause it over': function(a, b){ specHelper.assert.equal(a, "hello"); } }
// });


// suite.addBatch({
//   'actionCluster.stop - 0':{
//     topic: function(){ specHelper.stopServer(0, this.callback); },
//     'actionHero should be stopped - 0': function(resp){ specHelper.assert.equal(resp, true); } }
// });
// 
// suite.addBatch({
//   'actionCluster.stop - 1':{
//     topic: function(){ specHelper.stopServer(1, this.callback); },
//     'actionHero should be stopped - 0': function(resp){ specHelper.assert.equal(resp, true); } }
// });
// 
// suite.addBatch({
//   'actionCluster.stop - 2':{
//     topic: function(){ specHelper.stopServer(2, this.callback); },
//     'actionHero should be stopped - 0': function(resp){ specHelper.assert.equal(resp, true); } }
// });

// export
suite.export(module);