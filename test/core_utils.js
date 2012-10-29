describe('Core: Utils', function(){
  var specHelper = require('../helpers/_specHelper.js').specHelper;
  var apiObj = {};
  var should = require("should");

  before(function(done){
    specHelper.prepare(0, function(api){ 
      apiObj = specHelper.cleanAPIObject(api);
      done();
    })
  });

  it('utils.sqlDateTime default', function(done){
  	specHelper.utils.sqlDateTime().should.be.a('string');
  	done();
  });

  it('utils.sqlDateTime specific time', function(done){
  	var now = new Date(0); 
  	var now_utc = new Date(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(),  now.getUTCHours(), now.getUTCMinutes(), now.getUTCSeconds());
  	specHelper.utils.sqlDateTime(now_utc).should.equal("1970-01-01 00:00:00");
  	done();
  });

  it('utils.randomString', function(done){
  	var randomString = specHelper.utils.randomString(100);
  	randomString.should.be.a('string');
  	randomString.length.should.equal(17);
	var i = 0;
	while(i < 1000){
	    randomString.should.not.equal(specHelper.utils.randomString(100));
	    i++;
	}
  	done();
  });

  it('utils.hashLength', function(done){
  	var testHash = { a: 1, b: 2, c: {aa: 1, bb: 2}};
  	specHelper.utils.hashLength(testHash).should.equal(3)
  	specHelper.utils.hashLength({}).should.equal(0)
  	done();
  });

  it('utils.sleepSync', function(done){
  	var start = new Date();
	specHelper.utils.sleepSync(.1) 
	var end = new Date();
	(end - start).should.be.within(100, 200);
  	done();
  });

  it('utils.arrayUniqueify', function(done){
  	var a = [1,2,3,3,4,4,4,5,5,5]
  	specHelper.utils.arrayUniqueify(a).should.eql([1,2,3,4,5]);
  	done();
  });

  it('utils.objClone', function(done){
  	var a = {
  		a: 1,
  		b: 2,
  		c: {
  			first: 1,
  			second: 2
  		}
  	}
  	var b = specHelper.utils.objClone(a);
  	a.should.eql(b);
  	delete a.a
  	a.should.not.eql(b);
  	done();
  });

});