describe('Core: Tasks', function(){
  var specHelper = require(__dirname + '/_specHelper.js').specHelper;
  var apiObj = {};
  var rawAPI = {};
  var should = require("should");
  var taskOutput = [];
  var queue = 'test';

  before(function(done){
    this.timeout(10000)
    specHelper.stopServer(0, function(api){ 
      specHelper.prepare(0, function(api){ 
        rawAPI = api;
        apiObj = specHelper.cleanAPIObject(api);

        rawAPI.tasks.tasks['regular_task'] = {
          name: 'regular',
          description: 'task: ' + this.name,
          queue: specHelper.queue,
          frequency: 0,
          plugins: [],
          pluginOptions: {},
          run: function(api, params, next){
            taskOutput.push(params.word);
            next();
          }
        }

        rawAPI.tasks.tasks['periodic_task'] = {
          name: 'periodic_task',
          description: 'task: ' + this.name,
          queue: specHelper.queue,
          frequency: 500,
          plugins: [],
          pluginOptions: {},
          run: function(api, params, next){
            taskOutput.push(params.word);
            next();
          }
        }

        api.tasks.jobs['regular_task']  = api.tasks.jobWrapper('regular_task');
        api.tasks.jobs['periodic_task'] = api.tasks.jobWrapper('periodic_task');

        done();
      });
    });
  });

  after(function(done){
    specHelper.stopServer(0, function(api){ 
      delete rawAPI.tasks.tasks['regular_task'];
      delete rawAPI.tasks.tasks['periodic_task'];
      done();
    })
  });

  beforeEach(function(done){
    taskOutput = [];
    rawAPI.resque.queue.connection.redis.flushdb(function(){
      done();
    });
  });

  afterEach(function(done){
    rawAPI.resque.stopScheduler(function(){
      rawAPI.resque.stopWorkers(function(){
        done();
      });
    });
  })

  it('setup worked', function(done){
    rawAPI.utils.hashLength(rawAPI.tasks.tasks).should.equal(2 + 1);
    done();
  });

  it('a bad task definition causes an exception'); //TODO

  it('all queues should start empty', function(done){
    rawAPI.resque.queue.length(specHelper.queue, function(err, length){
      should.not.exist(err);
      length.should.equal(0);
      done();
    });
  });

  it('no delayed tasks should be scheduled', function(done){
    rawAPI.resque.queue.scheduledAt(specHelper.queue, 'periodic_task', {}, function(err, timestamps){
      should.not.exist(err);
      timestamps.length.should.equal(0);
      done();
    });
  });

  it('all perioduc tasks can be enqueued at boot', function(done){
    rawAPI.tasks.enqueueAllRecurentJobs(function(){
      rawAPI.resque.queue.length(specHelper.queue, function(err, length){
        should.not.exist(err);
        length.should.equal(1);
        done();
      });
    });
  });

  it('re-enquing a periodc task should not enqueue it again', function(done){
    rawAPI.tasks.enqueue('periodic_task', function(err){
      rawAPI.tasks.enqueue('periodic_task', function(err){
        rawAPI.resque.queue.length(specHelper.queue, function(err, length){
          should.not.exist(err);
          length.should.equal(1);
          done();
        });
      });
    });
  });

  it('can add a normal job', function(done){
    rawAPI.tasks.enqueue('regular_task', {word: 'first'}, function(err){
      rawAPI.resque.queue.length(specHelper.queue, function(err, length){
        should.not.exist(err);
        length.should.equal(1);
        done();
      });
    });
  });

  it('can add a delayed job', function(done){
    var time = new Date().getTime() + 1000;
    rawAPI.tasks.enqueueAt(time, 'regular_task', {word: 'first'}, function(err){
      rawAPI.resque.queue.scheduledAt(specHelper.queue, 'regular_task', {word: 'first'}, function(err, timestamps){
        should.not.exist(err);
        timestamps.length.should.equal(1);
        var complete_time = Math.floor(time / 1000);
        Number(timestamps[0]).should.be.within(complete_time, complete_time + 2)
        done();
      });
    });
  });

  it('I can remove an enqueued job', function(done){
    rawAPI.tasks.enqueue('regular_task', {word: 'first'}, function(err){
      rawAPI.resque.queue.length(specHelper.queue, function(err, length){
        length.should.equal(1);
        rawAPI.tasks.del(specHelper.queue, 'regular_task', {word: 'first'}, function(err, count){
          count.should.equal(1);
          rawAPI.tasks.del(specHelper.queue, 'regular_task', {word: 'first'}, function(err, count){
            count.should.equal(0);
            done();
          });
        });
      });
    });
  });

  it('I can remove a delayed job', function(done){
    rawAPI.tasks.enqueueIn(1000, 'regular_task', {word: 'first'}, function(err){
      rawAPI.resque.queue.scheduledAt(specHelper.queue, 'regular_task', {word: 'first'}, function(err, timestamps){
        timestamps.length.should.equal(1);
        rawAPI.tasks.delDelayed(specHelper.queue, 'regular_task', {word: 'first'}, function(err, timestamps){
          timestamps.length.should.equal(1);
          rawAPI.tasks.delDelayed(specHelper.queue, 'regular_task', {word: 'first'}, function(err, timestamps){
            timestamps.length.should.equal(0);
            done();
          });
        });
      });
    });
  });

  it('I can remove and stop a recurring task', function(done){
    // enqueue the delayed job 2x, one in each type of queue
    rawAPI.tasks.enqueue('periodic_task', {}, function(err){
      rawAPI.tasks.enqueueIn(1000, 'periodic_task', {}, function(err){
        rawAPI.tasks.stopRecurrentJob('periodic_task', function(err, count){
          count.should.equal(2);
          done();
        });
      });
    });    
  });

  it('will clear crashed wokrers when booting'); //TODO

  describe('full worker flow', function(){
    
    it('normal tasks work', function(done){
      rawAPI.tasks.enqueue('regular_task', {word: 'first'}, function(err){
        rawAPI.configData.tasks.queues = ["*"];
        rawAPI.resque.startWorkers(function(){
          setTimeout(function(){
            taskOutput[0].should.equal('first');
            done();
          }, 500);
        });
      }); 
    });

    it('delayed tasks work');

    it('recurrent tasks work');

    it('poping an unknown job will throw an error, but not crash the server');

  });

});