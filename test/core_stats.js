describe('Core: Stats', function(){
  var specHelper = require(__dirname + '/_specHelper.js').specHelper;
  var apiObj = {};
  var should = require("should");
  var testCounterName = 'testCounterName';
  var oldValues = { global: 0, local: 0 };

  before(function(done){
    this.timeout(5000);
    specHelper.prepare(0, function(api){ 
      apiObj = specHelper.cleanAPIObject(api);
      done();
    })
  });

  it('stats methods should exist', function(done){
    apiObj.stats.should.be.an.instanceOf(Object);
    apiObj.stats.increment.should.be.an.instanceOf(Function);
    apiObj.stats.set.should.be.an.instanceOf(Function);
    apiObj.stats.get.should.be.an.instanceOf(Function);
    apiObj.stats.getAll.should.be.an.instanceOf(Function);
    done();
  });

  it('get old values from global and local collections shoud work', function(done){
    apiObj.stats.get(testCounterName, apiObj.stats.collections.global, function(err, value){
      should.not.exist(err);
      oldValues.global = value ? value : 0;
  
      apiObj.stats.get(testCounterName, apiObj.stats.collections.local, function(err, value){
        should.not.exist(err);
        oldValues.local = value ? value : 0;
        done();
      });
    });
  });

  it('counter increasing shoud work correctly', function(done){
    apiObj.stats.increment(testCounterName, 2, function(err, value){
      should.not.exist(err);

      apiObj.stats.getAll(function(err, collections){
        should.not.exist(err);
        Number(collections.global.testCounterName).should.equal(
          oldValues.global + 2
        );
        Number(collections.local.testCounterName).should.equal(
          oldValues.global + 2
        );        
        done();
      });
    });
  });

  it('set a local counter shoud work correctly', function(done){
    apiObj.stats.set(testCounterName, 426, function(err, value){
      should.not.exist(err);

      apiObj.stats.get(testCounterName, apiObj.stats.collections.local, function(err, value){
        should.not.exist(err);
        Number(value).should.equal(426);
        done();
      });
    });
  });

  it('clean', function(done){
    apiObj.redis.client.multi()
      .hdel(apiObj.stats.collections.local, testCounterName)
      .hdel(apiObj.stats.collections.global, testCounterName)
      .exec(function(err, res){
        should.not.exist(err);
        done()
      });
  });
});