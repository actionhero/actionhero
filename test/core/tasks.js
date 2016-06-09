var should = require('should');
var actionheroPrototype = require(__dirname + '/../../actionhero.js').actionheroPrototype;
var actionhero = new actionheroPrototype();
var api;

var taskOutput = [];
var queue = 'testQueue';

describe('Core: Tasks', function(){

  before(function(done){
    actionhero.start(function(error, a){
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
      };

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
      };

      api.tasks.tasks.slowTask = {
        name: 'slowTask',
        description: 'task: ' + this.name,
        queue: queue,
        frequency: 0,
        plugins: [],
        pluginOptions: {},
        run: function(api, params, next){
          taskOutput.push('slowTask');
          setTimeout(next, 5000);
        }
      };

      api.tasks.jobs.regularTask  = api.tasks.jobWrapper('regularTask');
      api.tasks.jobs.periodicTask = api.tasks.jobWrapper('periodicTask');
      api.tasks.jobs.slowTask     = api.tasks.jobWrapper('slowTask');

      done();
    });
  });

  after(function(done){
    delete api.tasks.tasks.regularTask;
    delete api.tasks.tasks.periodicTask;
    delete api.tasks.tasks.slowTask;
    delete api.tasks.jobs.regularTask;
    delete api.tasks.jobs.periodicTask;
    delete api.tasks.jobs.slowTask;

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
  });

  it('a bad task definition causes an exception', function(done){
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
    Object.keys(api.tasks.tasks).length.should.equal(3 + 1);
    done();
  });

  it('all queues should start empty', function(done){
    api.resque.queue.length(queue, function(error, length){
      should.not.exist(error);
      length.should.equal(0);
      done();
    });
  });

  it('can run a task manually', function(done){
    api.specHelper.runTask('regularTask', {word: 'theWord'}, function(){
      taskOutput[0].should.equal('theWord');
      done();
    });
  });

  it('no delayed tasks should be scheduled', function(done){
    api.resque.queue.scheduledAt(queue, 'periodicTask', {}, function(error, timestamps){
      should.not.exist(error);
      timestamps.length.should.equal(0);
      done();
    });
  });

  it('all periodic tasks can be enqueued at boot', function(done){
    api.tasks.enqueueAllRecurrentJobs(function(error){
      should.not.exist(error);
      api.resque.queue.length(queue, function(error, length){
        should.not.exist(error);
        length.should.equal(1);
        done();
      });
    });
  });

  it('re-enqueuing a periodic task should not enqueue it again', function(done){
    api.tasks.enqueue('periodicTask', function(error){
      should.not.exist(error);
      api.tasks.enqueue('periodicTask', function(error){
        should.not.exist(error);
        api.resque.queue.length(queue, function(error, length){
          should.not.exist(error);
          length.should.equal(1);
          done();
        });
      });
    });
  });

  it('can add a normal job', function(done){
    api.tasks.enqueue('regularTask', {word: 'first'}, function(error){
      should.not.exist(error);
      api.resque.queue.length(queue, function(error, length){
        should.not.exist(error);
        length.should.equal(1);
        done();
      });
    });
  });

  it('can add a delayed job', function(done){
    var time = new Date().getTime() + 1000;
    api.tasks.enqueueAt(time, 'regularTask', {word: 'first'}, function(error){
      should.not.exist(error);
      api.resque.queue.scheduledAt(queue, 'regularTask', {word: 'first'}, function(error, timestamps){
        should.not.exist(error);
        timestamps.length.should.equal(1);
        var completeTime = Math.floor(time / 1000);
        Number(timestamps[0]).should.be.within(completeTime, completeTime + 2);
        done();
      });
    });
  });

  it('can see enqueued timestmps & see jobs within those timestamps (single + batch)', function(done){
    var time = new Date().getTime() + 1000;
    var roundedTime = Math.round(time / 1000) * 1000;
    api.tasks.enqueueAt(time, 'regularTask', {word: 'first'}, function(error){
      api.tasks.timestamps(function(error, timestamps){
        should.not.exist(error);
        timestamps.length.should.equal(1);
        timestamps[0].should.equal(roundedTime);

        api.tasks.delayedAt(roundedTime, function(error, tasks){
          should.not.exist(error);
          tasks.length.should.equal(1);
          tasks[0]['class'].should.equal('regularTask');
        });

        api.tasks.allDelayed(function(error, allTasks){
          should.not.exist(error);
          Object.keys(allTasks).length.should.equal(1);
          Object.keys(allTasks)[0].should.equal(String(roundedTime));
          allTasks[roundedTime][0]['class'].should.equal('regularTask');
          done();
        });

      });
    });
  });

  it('I can remove an enqueued job', function(done){
    api.tasks.enqueue('regularTask', {word: 'first'}, function(error){
      should.not.exist(error);
      api.resque.queue.length(queue, function(error, length){
        length.should.equal(1);
        api.tasks.del(queue, 'regularTask', {word: 'first'}, function(error, count){
          count.should.equal(1);
          api.resque.queue.length(queue, function(error, length){
            length.should.equal(0);
            done();
          });
        });
      });
    });
  });

  it('I can remove a delayed job', function(done){
    api.tasks.enqueueIn(1000, 'regularTask', {word: 'first'}, function(error){
      should.not.exist(error);
      api.resque.queue.scheduledAt(queue, 'regularTask', {word: 'first'}, function(error, timestamps){
        timestamps.length.should.equal(1);
        api.tasks.delDelayed(queue, 'regularTask', {word: 'first'}, function(error, timestamps){
          timestamps.length.should.equal(1);
          api.tasks.delDelayed(queue, 'regularTask', {word: 'first'}, function(error, timestamps){
            timestamps.length.should.equal(0);
            done();
          });
        });
      });
    });
  });

  it('I can remove and stop a recurring task', function(done){
    // enqueue the delayed job 2x, one in each type of queue
    api.tasks.enqueue('periodicTask', {}, function(error){
      should.not.exist(error);
      api.tasks.enqueueIn(1000, 'periodicTask', {}, function(error){
        should.not.exist(error);
        api.tasks.stopRecurrentJob('periodicTask', function(error, count){
          count.should.equal(2);
          done();
        });
      });
    });
  });

  describe('details view in a working system', function(){

    it('can use api.tasks.details to learn about the system', function(done){
      this.timeout(10 * 1000);

      api.config.tasks.queues = ['*'];

      api.tasks.enqueue('slowTask', {a:1}, function(error){
        api.resque.multiWorker.start(function(){
          setTimeout(function(){
            api.tasks.details(function(error, details){
              should.not.exist(error);
              Object.keys(details.queues).should.deepEqual(['testQueue']);
              details.queues.testQueue.length.should.equal(0);
              Object.keys(details.workers).length.should.equal(1);
              var workerName = Object.keys(details.workers)[0];
              details.workers[workerName].queue.should.equal('testQueue');
              details.workers[workerName].payload.args.should.deepEqual([{a:1}]);
              details.workers[workerName].payload['class'].should.equal('slowTask');
              setTimeout(done, 5000);
            });
          }, 2000);
        });
      });
    });

  });

  describe('full worker flow', function(){

    it('normal tasks work', function(done){
      api.tasks.enqueue('regularTask', {word: 'first'}, function(error){
        should.not.exist(error);
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
      api.tasks.enqueueIn(100, 'regularTask', {word: 'delayed'}, function(error){
        should.not.exist(error);
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
        job['class'].should.equal('someCrazyTask');
        job.queue.should.equal('testQueue');
        String(f).should.equal('Error: No job defined for class \'someCrazyTask\'');
        api.resque.multiWorker.removeListener('failure', listener);
        done();
      };

      api.resque.multiWorker.on('failure', listener);

      api.resque.queue.enqueue(queue, 'someCrazyTask', {}, function(){
        api.resque.multiWorker.start();
      });
    });

  });

});
