describe('Core: Cache', function(){
  var specHelper = require('../helpers/_specHelper.js').specHelper;
  var apiObj = {};
  var should = require("should");

  before(function(done){
    specHelper.prepare(0, function(api){ 
      apiObj = specHelper.cleanAPIObject(api);
      done();
    })
  });

  it('cache methods should exist', function(done){
      apiObj.cache.should.be.an.instanceOf(Object);
      apiObj.cache.save.should.be.an.instanceOf(Function);
      apiObj.cache.load.should.be.an.instanceOf(Function);
      apiObj.cache.destroy.should.be.an.instanceOf(Function);
      done();
  });

  it('cache.save', function(done){
  	apiObj.cache.save(apiObj,"testKey","abc123",null,function(err, resp){
      should.not.exist(err);
  		resp.should.equal(true);
  		done();
  	});
  });

  it('cache.load', function(done){
  	apiObj.cache.load(apiObj,"testKey",function(err, resp){
  		resp.should.equal("abc123");
  		done();
  	});
  });

  it('cache.load failures', function(done){
  	apiObj.cache.load(apiObj,"something else",function(err, resp){
      String(err).should.equal("Error: Object not found");
  		should.equal(null, resp);
  		done();
  	});
  });

  it('cache.destroy', function(done){
  	apiObj.cache.destroy(apiObj,"testKey",function(err, resp){
  		resp.should.equal(true);
  		done();
  	});
  });

  it('cache.destroy failure', function(done){
  	apiObj.cache.destroy(apiObj,"testKey",function(err, resp){
  		resp.should.equal(false);
  		done();
  	});
  });

  it('cache.save with expire time', function(done){
  	apiObj.cache.save(apiObj,"testKey","abc123",10,function(err, resp){
  		resp.should.equal(true);
  		done();
  	});
  });

  it('cache.load with expired items should not return them', function(done){
  	apiObj.cache.save(apiObj,"testKey_slow","abc123",10,function(err, save_resp){
  		save_resp.should.equal(true);
  		setTimeout(function(){
	  		apiObj.cache.load(apiObj,"testKey_slow",function(err, load_resp){
          String(err).should.equal("Error: Object expired")
		  		should.equal(null, load_resp);
		  		done();
		  	});
	  	}, 20);
  	});
  });

  it('cache.load with negative expire times will never load', function(done){
  	apiObj.cache.save(apiObj,"testKeyInThePast","abc123",-1,function(err, save_resp){
  		save_resp.should.equal(true);
  		apiObj.cache.load(apiObj,"testKeyInThePast",function(err, load_resp){
        String(err).should.equal("Error: Object expired")
	  		should.equal(null, load_resp);
	  		done();
	  	});
  	});
  });

  it('cache.save does not need to pass expireTime', function(done){
  	apiObj.cache.save(apiObj,"testKeyForNullExpireTime","abc123",function(err, save_resp){
  		save_resp.should.equal(true);
  		apiObj.cache.load(apiObj,"testKeyForNullExpireTime",function(err, load_resp){
	  		load_resp.should.equal("abc123");
	  		done();
	  	});
  	});
  });

  it('cache.save works with arrays', function(done){
  	apiObj.cache.save(apiObj,"array_key",[1,2,3],function(err, save_resp){
  		save_resp.should.equal(true);
  		apiObj.cache.load(apiObj,"array_key",function(err, load_resp){
	  		load_resp.should.include(1);
	  		load_resp.should.include(2);
	  		load_resp.should.include(3);
	  		done();
	  	});
  	});
  });

  it('cache.save works with objects', function(done){
  	var data = {};
	data.thing = "stuff";
	data.otherThing = [1,2,3];
  	apiObj.cache.save(apiObj,"obj_key",data,function(err, save_resp){
  		save_resp.should.equal(true);
  		apiObj.cache.load(apiObj,"obj_key",function(err, load_resp){
	  		load_resp.thing.should.equal("stuff");
	  		load_resp.otherThing.should.include(1);
	  		load_resp.otherThing.should.include(2);
	  		load_resp.otherThing.should.include(3);
	  		done();
	  	});
  	});
  });

});