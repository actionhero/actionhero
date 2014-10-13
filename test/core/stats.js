var should = require('should');
var actionheroPrototype = require(__dirname + '/../../actionhero.js').actionheroPrototype;
var actionhero = new actionheroPrototype();
var api;
var testKey = 'test:stats'

describe('Core: Stats', function(){

  before(function(done){
    actionhero.start(function(err, a){
      api = a;
      done();
    })
  });

  after(function(done){
    actionhero.stop(function(){
      done();
    });
  });

  beforeEach(function(done){
    api.stats.pendingIncrements = {};
    done();
  })

  afterEach(function(done){
    api.redis.client.del(testKey, function(){
      done();
    });
  })

  it('stats methods should exist', function(done){
    api.stats.should.be.an.instanceOf(Object);
    api.stats.increment.should.be.an.instanceOf(Function);
    api.stats.get.should.be.an.instanceOf(Function);
    api.stats.getAll.should.be.an.instanceOf(Function);
    done();
  });

  it('incrementing enqueues items for later', function(done){
    api.stats.increment('thing', 1);
    api.stats.increment('thing');
    api.stats.increment('Otherthing', -1);

    api.stats.pendingIncrements.thing.should.equal(2);
    api.stats.pendingIncrements.Otherthing.should.equal(-1);

    done();
  });

  it('buffered stats can be written', function(done){
    api.stats.increment('thing', 1);
    api.stats.writeIncrements(function(){
      api.redis.client.hgetall(testKey, function(err, data){
        Number(data.thing).should.equal(1);
        done();
      });
    });
  });

  it('stats can be read', function(done){
    api.stats.increment('thing', 1);
    api.stats.writeIncrements(function(){
      api.stats.get('thing', function(err, data){
        Number(data).should.equal(1);
        done();
      });
    });
  });

  it('stats can be read all at once', function(done){
    api.stats.increment('thing', 1);
    api.stats.increment('otherThing', -1);
    api.stats.writeIncrements(function(){
      api.stats.getAll(function(err, data){
        Number(data[testKey].thing).should.equal(1);
        Number(data[testKey].otherThing).should.equal(-1);
        done();
      });
    });
  });

  describe('multiple stats keys', function(){

    before(function(){
      api.config.stats.keys = ['test:stats1', 'test:stats2'];
    });

    after(function(done){
      api.config.stats.keys = [testKey];
      api.redis.client.del('test:stats1', function(){
        api.redis.client.del('test:stats2', function(){
          done();
        });
      });
    });

    it('buffered stats can be written (to multiple hashes)', function(done){
      api.stats.increment('somethingElse', 1);
      api.stats.writeIncrements(function(){
        api.redis.client.hgetall('test:stats1', function(err, data1){
          api.redis.client.hgetall('test:stats2', function(err, data2){
            
            Number(data1.somethingElse).should.equal(1);
            Number(data2.somethingElse).should.equal(1);

            api.stats.getAll(function(err, data){
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