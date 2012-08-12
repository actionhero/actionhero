var specHelper = require('../helpers/_specHelper.js').specHelper;
var suite = specHelper.vows.describe('cache tests');
var apiObj = {};

suite.addBatch({
  'specHelper.prepare':{
    topic: function(){
      var cb = this.callback;
      specHelper.prepare(0, function(api){
        apiObj = api;
        cb();
      })
    },
    'api object should exist': function(){ specHelper.assert.isObject(apiObj); },
  }
});

suite.addBatch({
	"api.cache": {
    	topic: function(){ return apiObj },
    	'should exist: objects' : function(api){ specHelper.assert.isObject(api.cache); },
    	'should exist: save' : function(api){ specHelper.assert.isFunction(api.cache.save); },
    	'should exist: destroy' : function(api){ specHelper.assert.isFunction(api.cache.destroy); },
    	'should exist: load' : function(api){ specHelper.assert.isFunction(api.cache.load); }
	},
});

suite.addBatch({
	"cache.save": {
    	topic: function(){ apiObj.cache.save(apiObj,"testKey","abc123",null,this.callback) },
    	saved: function(resp, f){ specHelper.assert.equal(f, true); }
	},
});

suite.addBatch({
	"cache.save again": {
    	topic: function(){ apiObj.cache.save(apiObj,"testKey","abc123",null,this.callback) },
    	save: function(resp, f){ specHelper.assert.equal(f, true); }
	},
});

suite.addBatch({
	"cache.load sucess": {
    	topic: function(){ apiObj.cache.load(apiObj,"testKey",this.callback) },
    	save: function(resp, f){ specHelper.assert.equal(resp, "abc123"); }
	},
});

suite.addBatch({
	"cache.load fail": {
    	topic: function(){ apiObj.cache.load(apiObj,"something else",this.callback) },
    	save: function(resp, f){ specHelper.assert.equal(resp, null); }
	},
});

suite.addBatch({
	"cache.destroy sucess": {
    	topic: function(){ apiObj.cache.destroy(apiObj,"testKey",this.callback) },
    	save: function(resp, f){ specHelper.assert.equal(f, true); }
	},
});

suite.addBatch({
	"cache.destroy fail": {
    	topic: function(){ apiObj.cache.destroy(apiObj,"testKey",this.callback) },
    	save: function(resp, f){ specHelper.assert.equal(f, false); }
	},
});

// mess with expire time
suite.addBatch({
	"cache.save expire time win": {
    	topic: function(){ apiObj.cache.save(apiObj,"testKey_not_slow","abc123",10,this.callback) },
    	saved: function(resp, f){ specHelper.assert.equal(f, true); }
	},
});
suite.addBatch({
	"cache.load expire time win": {
    	topic: function(){ apiObj.cache.load(apiObj,"testKey_not_slow",this.callback) },
    	save: function(resp, f){ specHelper.assert.equal(resp, "abc123"); }
	},
});
suite.addBatch({
	"cache.save expire time fail": {
    	topic: function(){ 
			apiObj.cache.save(apiObj,"testKey_slow","abc123",0,this.callback) 
		},
    	saved: function(resp, f){ specHelper.assert.equal(f, true); }
	},
});
suite.addBatch({
	"cache.load expire time fail": {
    	topic: function(){ 
			var cb = this.callback;			
			setTimeout(function(){
				apiObj.cache.load(apiObj,"testKey_slow",cb)
			}, 1000);
		},
    	save: function(resp,f){specHelper.assert.equal(f, null); }
	},
});

// objects saved with negative expire time will not load
suite.addBatch({
	"cache.save expire negative": {
    	topic: function(){ apiObj.cache.save(apiObj,"testKeyInThePast","abc123",-1,this.callback) },
    	saved: function(resp, f){ specHelper.assert.equal(f, true); }
	},
});
suite.addBatch({
	"cache.load expire time negative should not load": {
    	topic: function(){ apiObj.cache.load(apiObj,"testKeyInThePast",this.callback) },
    	save: function(resp, f){  specHelper.assert.equal(resp, null); }
	},
});

// objects can have null expire time
suite.addBatch({
	"cache.save expire negative": {
    	topic: function(){ apiObj.cache.save(apiObj,"testKeyForNullExpireTime","abc123",this.callback) },
    	saved: function(resp, f){ specHelper.assert.equal(f, true); }
	},
});
suite.addBatch({
	"cache.load expire time negative should not load": {
    	topic: function(){ apiObj.cache.load(apiObj,"testKeyForNullExpireTime",this.callback) },
    	save: function(resp, f){  specHelper.assert.equal(resp, "abc123"); }
	},
});

// mess with object types to save
suite.addBatch({
	"cache.save array": {
    	topic: function(){ apiObj.cache.save(apiObj,"array_key",[1,2,3],null,this.callback) },
    	saved: function(resp, f){ specHelper.assert.equal(f, true); }
	},
});
suite.addBatch({
	"cache.load array": {
    	topic: function(){ apiObj.cache.load(apiObj,"array_key",this.callback) },
    	save: function(resp, f){
			specHelper.assert.isArray(resp);
			specHelper.assert.equal(resp[0], 1);  
			specHelper.assert.equal(resp[1], 2);  
			specHelper.assert.equal(resp[2], 3);  
		}
	},
});

suite.addBatch({
	"cache.save object": {
    	topic: function(){ 
			var data = {};
			data.thing = "stuff";
			data.otherThing = [1,2,3];
			apiObj.cache.save(apiObj,"obj_key",data,null,this.callback) 
		},
    	saved: function(resp, f){ specHelper.assert.equal(f, true); }
	},
});
suite.addBatch({
	"cache.load object": {
    	topic: function(){ apiObj.cache.load(apiObj,"obj_key",this.callback) },
    	save: function(resp, f){
			specHelper.assert.isObject(resp);
			specHelper.assert.equal(resp.thing, "stuff");  
			specHelper.assert.isArray(resp.otherThing);
			specHelper.assert.equal(resp.otherThing[0], 1); 
		}
	},
});


// export
suite.export(module);