var should = require('should');
var actionheroPrototype = require(__dirname + '/../../actionhero.js').actionheroPrototype;
var actionhero = new actionheroPrototype();
var api;

var taskOutput = [];
var queue = 'testQueue';

describe('Core: Tasks', function(){

  before(function(done){
    actionhero.start(function(err, a){
      api = a;

      api.resque.multiWorker.options.minTaskProcessors = 1;
      api.resque.multiWorker.options.maxTaskProcessors = 1;

      api.tasks.tasks.regularTask = {
        name: 'regular',
        description: 'task: ' + this.name,
        queue: queue,
        frequency: 0,
        plugins: [],
        pluginOptions: {},
        run: function(api, params, next){
          taskOutput.push(params.word);
          next();
        }
      }

      api.tasks.tasks.periodicTask = {
        name: 'periodicTask',
        description: 'task: ' + this.name,
        queue: queue,
        frequency: 100,
        plugins: [],
        pluginOptions: {},
        run: function(api, params, next){
          taskOutput.push('periodicTask');
          next();
        }
      }

      api.tasks.jobs.regularTask  = api.tasks.jobWrapper('regularTask');
      api.tasks.jobs.periodicTask = api.tasks.jobWrapper('periodicTask');

      done();
    })
  });

  after(function(done){
    delete api.tasks.tasks.regularTask;
    delete api.tasks.tasks.periodicTask;
    delete api.tasks.jobs.regularTask;
    delete api.tasks.jobs.periodicTask;

    api.resque.multiWorker.options.minTaskProcessors = 0;
    api.resque.multiWorker.options.maxTaskProcessors = 0;

    actionhero.stop(function(){
      done();
    });
  });

  beforeEach(function(done){
    taskOutput = [];
    api.resque.queue.connection.redis.flushdb(function(){
      done();
    });
  });

  afterEach(function(done){
    api.resque.stopScheduler(function(){
      api.resque.stopMultiWorker(function(){
        done();
      });
    });
  })

  it('a bad task definition causes an exception' , function(done){
    var badTask = {
      name: 'badTask',
      description: 'task',
      // queue: queue, // No Queue
      frequency: 100,
      plugins: [],
      pluginOptions: {},
      run: function(api, params, next){
        next();
      }
    };

    var response = api.tasks.validateTask(badTask);
    response.should.equal(false);
    done();
  });

  it('will clear crashed workers when booting'); //TODO

  it('setup worked', function(done){
    api.utils.hashLength(api.tasks.tasks).should.equal(2 + 1);
    done();
  });

  it('all queues should start empty', function(done){
    api.resque.queue.length(queue, function(err, length){
      should.not.exist(err);
      length.should.equal(0);
      done();
    });
  });

  it('can run a task manually', function(done){
    api.specHelper.runTask('regularTask', {word: 'theWord'}, function(){
      taskOutput[0].should.equal('theWord');
      done();
    })
  });

  it('no delayed tasks should be scheduled', function(done){
    api.resque.queue.scheduledAt(queue, 'periodicTask', {}, function(err, timestamps){
      should.not.exist(err);
      timestamps.length.should.equal(0);
      done();
    });
  });

  it('all periodic tasks can be enqueued at boot', function(done){
    api.tasks.enqueueAllRecurrentJobs(function(){
      api.resque.queue.length(queue, function(err, length){
        should.not.exist(err);
        length.should.equal(1);
        done();
      });
    });
  });

  it('re-enqueuing a periodic task should not enqueue it again', function(done){
    api.tasks.enqueue('periodicTask', function(err){
      should.not.exist(err);
      api.tasks.enqueue('periodicTask', function(err){
        should.not.exist(err);
        api.resque.queue.length(queue, function(err, length){
          should.not.exist(err);
          length.should.equal(1);
          done();
        });
      });
    });
  });

  it('can add a normal job', function(done){
    api.tasks.enqueue('regularTask', {word: 'first'}, function(err){
      should.not.exist(err);
      api.resque.queue.length(queue, function(err, length){
        should.not.exist(err);
        length.should.equal(1);
        done();
      });
    });
  });

  it('can add a delayed job', function(done){
    var time = new Date().getTime() + 1000;
    api.tasks.enqueueAt(time, 'regularTask', {word: 'first'}, function(err){
      should.not.exist(err);
      api.resque.queue.scheduledAt(queue, 'regularTask', {word: 'first'}, function(err, timestamps){
        should.not.exist(err);
        timestamps.length.should.equal(1);
        var completeTime = Math.floor(time / 1000);
        Number(timestamps[0]).should.be.within(completeTime, completeTime + 2)
        done();
      });
    });
  });

  it('can see enqueued timestmps & see jobs within those timestamps (single + batch)', function(done){
    var time = new Date().getTime() + 1000;
    var roundedTime = Math.round(time/1000) * 1000;
    api.tasks.enqueueAt(time, 'regularTask', {word: 'first'}, function(err){
      api.tasks.timestamps(function(err, timestamps){
        should.not.exist(err);
        timestamps.length.should.equal(1)
        timestamps[0].should.equal(roundedTime);
        
      api.tasks.delayedAt(roundedTime, function(err, tasks){
        should.not.exist(err);
        tasks.length.should.equal(1);
        tasks[0].class.should.equal('regularTask');
      });

      api.tasks.allDelayed(function(err, allTasks){
        should.not.exist(err);
        Object.keys(allTasks).length.should.equal(1);
        Object.keys(allTasks)[0].should.equal(String(roundedTime));
        allTasks[roundedTime][0].class.should.equal('regularTask');
        done();
      });

      });
    });
  });

  it('I can remove an enqueued job', function(done){
    api.tasks.enqueue('regularTask', {word: 'first'}, function(err){
      should.not.exist(err);
      api.resque.queue.length(queue, function(err, length){
        length.should.equal(1);
        api.tasks.del(queue, 'regularTask', {word: 'first'}, function(err, count){
          count.should.equal(1);
          api.resque.queue.length(queue, function(err, length){
            length.should.equal(0);
            done();
          });
        });
      });
    });
  });

  it('I can remove a delayed job', function(done){
    api.tasks.enqueueIn(1000, 'regularTask', {word: 'first'}, function(err){
      should.not.exist(err);
      api.resque.queue.scheduledAt(queue, 'regularTask', {word: 'first'}, function(err, timestamps){
        timestamps.length.should.equal(1);
        api.tasks.delDelayed(queue, 'regularTask', {word: 'first'}, function(err, timestamps){
          timestamps.length.should.equal(1);
          api.tasks.delDelayed(queue, 'regularTask', {word: 'first'}, function(err, timestamps){
            timestamps.length.should.equal(0);
            done();
          });
        });
      });
    });
  });

  it('I can remove and stop a recurring task', function(done){
    // enqueue the delayed job 2x, one in each type of queue
    api.tasks.enqueue('periodicTask', {}, function(err){
      should.not.exist(err);
      api.tasks.enqueueIn(1000, 'periodicTask', {}, function(err){
        should.not.exist(err);
        api.tasks.stopRecurrentJob('periodicTask', function(err, count){
          count.should.equal(2);
          done();
        });
      });
    });
  });

  describe('full worker flow', function(){

    it('normal tasks work', function(done){
      api.tasks.enqueue('regularTask', {word: 'first'}, function(err){
        should.not.exist(err);
        api.config.tasks.queues = ['*'];
        api.resque.multiWorker.start(function(){
          setTimeout(function(){
            taskOutput[0].should.equal('first');
            done();
          }, 500);
        });
      });
    });

    it('delayed tasks work', function(done){
      api.tasks.enqueueIn(100, 'regularTask', {word: 'delayed'}, function(err){
        should.not.exist(err);
        api.config.tasks.queues = ['*'];
        api.config.tasks.scheduler = true;
        api.resque.startScheduler(function(){
          api.resque.multiWorker.start(function(){
            setTimeout(function(){
              taskOutput[0].should.equal('delayed');
              done();
            }, 1500);
          });
        });
      });
    });

    it('recurrent tasks work', function(done){
      api.tasks.enqueueRecurrentJob('periodicTask', function(){
        api.config.tasks.queues = ['*'];
        api.config.tasks.scheduler = true;
        api.resque.startScheduler(function(){
          api.resque.multiWorker.start(function(){
            setTimeout(function(){
              taskOutput[0].should.equal('periodicTask');
              taskOutput[1].should.equal('periodicTask');
              taskOutput[2].should.equal('periodicTask');
              // the task may have run more than 3 times, we just want to ensure that it happened more than once
              done();
            }, 1500);
          });
        });
      });
    });

    it('popping an unknown job will throw an error, but not crash the server', function(done){
      api.config.tasks.queues = ['*'];

      var listener = function(workerId, queue, job, f){
        queue.should.equal(queue);
        job.class.should.equal('someCrazyTask')
        job.queue.should.equal('testQueue')
        String(f).should.equal('Error: No job defined for class \'someCrazyTask\'');
        api.resque.multiWorker.removeListener('failure', listener);
        done();
      }

      api.resque.multiWorker.on('failure', listener);

      api.resque.queue.enqueue(queue, 'someCrazyTask', {}, function(){
        api.resque.multiWorker.start();
      });
    });

  });

});
