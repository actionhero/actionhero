describe('Core: Stats', function(){
  var specHelper = require(__dirname + '/_specHelper.js').specHelper;
  var apiObj = {};
  var should = require("should");
  var testCounterName = 'testCounterName';
  var oldValues = { global: 0, local: 0 };
  var testKey = 'test:stats'

  before(function(done){
    this.timeout(5000);
    specHelper.params[0].stats.keys = [testKey];
    specHelper.prepare(0, function(api){ 
      apiObj = specHelper.cleanAPIObject(api);
      done();
    })
  });

  beforeEach(function(done){
    apiObj.stats.pendingIncrements = {};
    done();
  })

  afterEach(function(done){
    apiObj.redis.client.del(testKey, function(err){
      done();
    });
  })

  after(function(done){
    specHelper.params[0].stats.keys = [];
    done();
  });

  it('stats methods should exist', function(done){
    apiObj.stats.should.be.an.instanceOf(Object);
    apiObj.stats.increment.should.be.an.instanceOf(Function);
    apiObj.stats.get.should.be.an.instanceOf(Function);
    apiObj.stats.getAll.should.be.an.instanceOf(Function);
    done();
  });

  it('incremnting enqueues items for later', function(done){
    apiObj.stats.increment("thing", 1);
    apiObj.stats.increment("thing");
    apiObj.stats.increment("Otherthing", -1);

    apiObj.stats.pendingIncrements['thing'].should.equal(2);
    apiObj.stats.pendingIncrements['Otherthing'].should.equal(-1);

    done();
  });

  it('buffered stats can be written', function(done){
    apiObj.stats.increment("thing", 1);
    apiObj.stats.writeIncrements(function(){
      apiObj.redis.client.hgetall(testKey, function(err, data){
        Number(data.thing).should.equal(1);
        done();
      });
    }); 
  });

  it('stats can be read', function(done){
    apiObj.stats.increment("thing", 1);
    apiObj.stats.writeIncrements(function(){
      apiObj.stats.get("thing", function(err, data){
        Number(data).should.equal(1);
        done();
      });
    });
  });

  it('stats can be read all at once', function(done){
    apiObj.stats.increment("thing", 1);
    apiObj.stats.increment("otherThing", -1);
    apiObj.stats.writeIncrements(function(){
      apiObj.stats.getAll(function(err, data){
        Number(data[testKey].thing).should.equal(1);
        Number(data[testKey].otherThing).should.equal(-1);
        done();
      });
    });
  });

  describe('multiple stats keys', function(){

    before(function(){
      apiObj.configData.stats.keys = ['test:stats1', 'test:stats2'];
    });

    after(function(done){
      apiObj.configData.stats.keys = [testKey];
      apiObj.redis.client.del('test:stats1', function(){
        apiObj.redis.client.del('test:stats2', function(){
          done();
        });
      });
    });

    it('buffered stats can be written (to multiple hashes)', function(done){
      apiObj.stats.increment("somethingElse", 1);
      apiObj.stats.writeIncrements(function(){
        apiObj.redis.client.hgetall('test:stats1', function(err, data1){
          apiObj.redis.client.hgetall('test:stats2', function(err, data2){
            
            Number(data1.somethingElse).should.equal(1);
            Number(data2.somethingElse).should.equal(1);

            apiObj.stats.getAll(function(err, data){
              Number(data['test:stats1'].somethingElse).should.equal(1);
              Number(data['test:stats2'].somethingElse).should.equal(1);
              done();
            });

          });
        });
      });
    });

  });

});