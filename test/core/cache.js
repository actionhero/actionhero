var fs     = require('fs');
var os     = require('os');
var path   = require('path');
var should = require('should');
var async  = require('async');
var actionheroPrototype = require(__dirname + '/../../actionhero.js').actionheroPrototype;
var actionhero = new actionheroPrototype();
var api;

describe('Core: Cache', function(){

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

  it('cache methods should exist', function(done){
    api.cache.should.be.an.instanceOf(Object);
    api.cache.save.should.be.an.instanceOf(Function);
    api.cache.load.should.be.an.instanceOf(Function);
    api.cache.destroy.should.be.an.instanceOf(Function);
    done();
  });

  it('cache.save', function(done){
    api.cache.save('testKey','abc123',null,function(err, resp){
      should.not.exist(err);
      resp.should.equal(true);
      done();
    });
  });

  it('cache.load', function(done){
    api.cache.load('testKey',function(err, resp){
      resp.should.equal('abc123');
      done();
    });
  });

  it('cache.load failures', function(done){
    api.cache.load('something else',function(err, resp){
      String(err).should.equal('Error: Object not found');
      should.equal(null, resp);
      done();
    });
  });

  it('cache.destroy', function(done){
    api.cache.destroy('testKey',function(err, resp){
      resp.should.equal(true);
      done();
    });
  });

  it('cache.destroy failure', function(done){
    api.cache.destroy('testKey',function(err, resp){
      resp.should.equal(false);
      done();
    });
  });

  it('cache.save with expire time', function(done){
    api.cache.save('testKey','abc123',10,function(err, resp){
      resp.should.equal(true);
      done();
    });
  });

  it('cache.load with expired items should not return them', function(done){
    api.cache.save('testKey_slow', 'abc123', 10, function(err, saveResp){
      saveResp.should.equal(true);
      setTimeout(function(){
        api.cache.load('testKey_slow', function(err, loadResp){
          String(err).should.equal('Error: Object expired')
          should.equal(null, loadResp);
          done();
        });
      }, 20);
    });
  });

  it('cache.load with negative expire times will never load', function(done){
    api.cache.save('testKeyInThePast', 'abc123', -1, function(err, saveResp){
      saveResp.should.equal(true);
      api.cache.load('testKeyInThePast', function(err, loadResp){
        (String(err).indexOf('Error: Object') >= 0).should.equal(true)
        should.equal(null, loadResp);
        done();
      });
    });
  });

  it('cache.save does not need to pass expireTime', function(done){
    api.cache.save('testKeyForNullExpireTime', 'abc123', function(err, saveResp){
      saveResp.should.equal(true);
      api.cache.load('testKeyForNullExpireTime', function(err, loadResp){
        loadResp.should.equal('abc123');
        done();
      });
    });
  });

  it('cache.load without changing the expireTime will re-apply the redis expire', function(done){
    var key = 'testKey'
    api.cache.save(key, 'val', 1000, function(){
      api.cache.load(key, function(err, loadResp){
        loadResp.should.equal('val');
        setTimeout(function(){
          api.cache.load(key, function(err, loadResp){
            String(err).should.equal('Error: Object not found')
            should.equal(null, loadResp);
            done();
          });
        }, 1001);
      });
    });
  });

  it('cache.load with options that extending expireTime should return cached item', function(done){
    var expireTime = 400
    var timeout = 320
    //save the initial key
    api.cache.save('testKey_slow', 'abc123', expireTime, function(err, saveResp){
      saveResp.should.equal(true)
      //wait for `timeout` and try to load the key
      setTimeout(function(){
        api.cache.load('testKey_slow', {expireTimeMS: expireTime}, function(err, loadResp){
          loadResp.should.equal('abc123')
          //wait another `timeout` and load the key again within the extended expire time
          setTimeout(function(){
            api.cache.load('testKey_slow', function(err, loadResp){
              loadResp.should.equal('abc123')
              //wait another `timeout` and the key load should fail without the extension
              setTimeout(function(){
                api.cache.load('testKey_slow', function(err, loadResp){
                  String(err).should.equal('Error: Object not found')
                  should.equal(null, loadResp)
                  done()
                })
              },timeout)
            });
          },timeout)
        })
      },timeout)
    })
  })

  it('cache.save works with arrays', function(done){
    api.cache.save('array_key', [1, 2, 3], function(err, saveResp){
      saveResp.should.equal(true);
      api.cache.load('array_key', function(err, loadResp){
        loadResp[0].should.equal(1);
        loadResp[1].should.equal(2);
        loadResp[2].should.equal(3);
        done();
      });
    });
  });

  it('cache.save works with objects', function(done){
    var data = {};
    data.thing = 'stuff';
    data.otherThing = [1, 2, 3];
    api.cache.save('obj_key', data, function(err, saveResp){
      saveResp.should.equal(true);
      api.cache.load('obj_key', function(err, loadResp){
        loadResp.thing.should.equal('stuff');
        loadResp.otherThing[0].should.equal(1);
        loadResp.otherThing[1].should.equal(2);
        loadResp.otherThing[2].should.equal(3);
        done();
      });
    });
  });

  it('can clear the cache entirely', function(done){
    api.cache.save('thingA', 123, function(){
      api.cache.size(function(err, count){
        (count > 0).should.equal(true);
        api.cache.clear(function(){
          api.cache.size(function(err, count){
            count.should.equal(0);
            done();
          });
        });
      });
    });
  });

  describe('locks', function(){

    var key = 'testKey';
    afterEach(function(done){
      api.cache.lockName = api.id;
      api.cache.unlock(key, function(){
        done();
      });
    })

    it('things can be locked, checked, and unlocked aribitrarily', function(done){
      api.cache.lock(key, 100, function(err, lockOk){
        lockOk.should.equal(true);
        api.cache.checkLock(key, null, function(err, lockOk){
          lockOk.should.equal(true);
          api.cache.unlock(key, function(err, lockOk){
            lockOk.should.equal(true);
            done();
          });
        });
      });
    });

    it('locks have a TTL and the default will be assumed from config', function(done){
      api.cache.lock(key, null, function(err, lockOk){
        lockOk.should.equal(true);
        api.redis.client.ttl(api.cache.lockPrefix + key, function(err, ttl){
          (ttl >= 9).should.equal(true);
          (ttl <= 10).should.equal(true);
          done();
        });
      });
    });

    it('you can save an item if you do hold the lock', function(done){
      api.cache.lock(key, null, function(err, lockOk){
        lockOk.should.equal(true);
        api.cache.save(key, 'value', function(err, success){
          success.should.equal(true);
          done();
        });
      });
    });

    it('you cannot save a locked item if you do not hold the lock', function(done){
      api.cache.lock(key, null, function(err, lockOk){
        lockOk.should.equal(true);
        api.cache.lockName = 'otherId';
        api.cache.save(key, 'value', function(err){
          String(err).should.equal('Error: Object Locked')
          done();
        });
      });
    });

    it('you cannot destroy a locked item if you do not hold the lock', function(done){
      api.cache.lock(key, null, function(err, lockOk){
        lockOk.should.equal(true);
        api.cache.lockName = 'otherId';
        api.cache.destroy(key, function(err){
          String(err).should.equal('Error: Object Locked')
          done();
        });
      });
    });

    it('you can opt to retry to obtain a lock if a lock is held (READ)', function(done){
      api.cache.lock(key, 1, function(err, lockOk){ // will be rounded up to 1s
        lockOk.should.equal(true);
        api.cache.save(key, 'value', function(err, success){
          success.should.equal(true);

          api.cache.lockName = 'otherId';
          api.cache.checkLock(key, null, function(err, lockOk){
            lockOk.should.equal(false);

            var start = new Date().getTime();
            api.cache.load(key, {retry: 2000}, function(err, data){
              data.should.equal('value');
              var delta = new Date().getTime() - start;
              (delta >= 1000).should.equal(true)
              done();
            });

          });
        });
      });
    });

    describe('locks are actually blocking', function(){
      var originalLockName;

      before(function(){
        originalLockName = api.cache.lockName;
      });

      after(function(){
        api.cache.lockName = originalLockName;
      });

      it('locks are actually blocking', function(done){
        var key = 'test';
        var locksRetrieved = 0;
        var locksRejected  = 0;
        var concurentLocksCount = 100;
        var jobs = [];

        var go = function(next){
          // proxy for another actionhero instance accessing the same locked object
          api.cache.lockName = 'test-name-pass-' + (locksRetrieved + locksRejected);

          api.cache.checkLock(key, null, function(error, lockOk) {
            if(error){ return next(error); }

            if (lockOk) {
              locksRetrieved++;
              api.cache.lock(key, (1000 * 60), next);
            } else {
              locksRejected++;
              next();
            }
          });
        };

        for(var i = 0; i < concurentLocksCount; i++){
          jobs.push(go);
        }

        async.series(jobs, function(error){
          should.not.exist(error);
          locksRetrieved.should.be.equal(1); // Only first atempt
          locksRejected.should.be.equal(concurentLocksCount - 1); // Everything else
          done();
        });
      });

    });

  });

  describe('cache dump files', function(){

    if (typeof os.tmpdir !== 'function'){ os.tmpdir = os.tmpDir } // resolution for node v0.8.x
    var file = os.tmpdir() + path.sep + "cacheDump";

    it('can read write the cache to a dump file', function(done){
      api.cache.clear(function(){
        api.cache.save('thingA', 123, function(){
          api.cache.dumpWrite(file, function(error, count){
            count.should.equal(1);
            var body = JSON.parse(String(fs.readFileSync(file)));
            var content = JSON.parse(body['actionhero:cache:thingA']);
            content.value.should.equal(123);
            done();
          });
        });
      });
    });

    it('can laod the cache from a dump file', function(done){
      api.cache.clear(function(){
        api.cache.dumpRead(file, function(error, count){
          count.should.equal(1);
          api.cache.load('thingA', function(err, value){
            value.should.equal(123);
            done();
          });
        });
      });
    });

  })

})