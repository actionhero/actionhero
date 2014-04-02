var should = require('should');
var actionheroPrototype = require(__dirname + "/../../actionhero.js").actionheroPrototype;
var actionhero = new actionheroPrototype();
var api;

var taskOutput = [];
var queue = 'testQueue';

describe('Core: Tasks', function(){

  before(function(done){
    actionhero.start(function(err, a){
      api = a;

      api.tasks.tasks['regular_task'] = {
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

      api.tasks.tasks['periodic_task'] = {
        name: 'periodic_task',
        description: 'task: ' + this.name,
        queue: queue,
        frequency: 100,
        plugins: [],
        pluginOptions: {},
        run: function(api, params, next){
          taskOutput.push('periodic_task');
          next();
        }
      }

      api.tasks.jobs['regular_task']  = api.tasks.jobWrapper('regular_task');
      api.tasks.jobs['periodic_task'] = api.tasks.jobWrapper('periodic_task');

      done();
    })
  });

  after(function(done){
    delete api.tasks.tasks['regular_task'];
    delete api.tasks.tasks['periodic_task'];
    delete api.tasks.jobs['regular_task'];
    delete api.tasks.jobs['periodic_task'];
    actionhero.stop(function(err){
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
      api.resque.stopWorkers(function(){
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
    api.specHelper.runTask('regular_task', {word: 'theWord'}, function(){
      taskOutput[0].should.equal('theWord');
      done();
    })
  });

  it('no delayed tasks should be scheduled', function(done){
    api.resque.queue.scheduledAt(queue, 'periodic_task', {}, function(err, timestamps){
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
    api.tasks.enqueue('periodic_task', function(err){
      api.tasks.enqueue('periodic_task', function(err){
        api.resque.queue.length(queue, function(err, length){
          should.not.exist(err);
          length.should.equal(1);
          done();
        });
      });
    });
  });

  it('can add a normal job', function(done){
    api.tasks.enqueue('regular_task', {word: 'first'}, function(err){
      api.resque.queue.length(queue, function(err, length){
        should.not.exist(err);
        length.should.equal(1);
        done();
      });
    });
  });

  it('can add a delayed job', function(done){
    var time = new Date().getTime() + 1000;
    api.tasks.enqueueAt(time, 'regular_task', {word: 'first'}, function(err){
      api.resque.queue.scheduledAt(queue, 'regular_task', {word: 'first'}, function(err, timestamps){
        should.not.exist(err);
        timestamps.length.should.equal(1);
        var complete_time = Math.floor(time / 1000);
        Number(timestamps[0]).should.be.within(complete_time, complete_time + 2)
        done();
      });
    });
  });

  it('I can remove an enqueued job', function(done){
    api.tasks.enqueue('regular_task', {word: 'first'}, function(err){
      api.resque.queue.length(queue, function(err, length){
        length.should.equal(1);
        api.tasks.del(queue, 'regular_task', {word: 'first'}, function(err, count){
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
    api.tasks.enqueueIn(1000, 'regular_task', {word: 'first'}, function(err){
      api.resque.queue.scheduledAt(queue, 'regular_task', {word: 'first'}, function(err, timestamps){
        timestamps.length.should.equal(1);
        api.tasks.delDelayed(queue, 'regular_task', {word: 'first'}, function(err, timestamps){
          timestamps.length.should.equal(1);
          api.tasks.delDelayed(queue, 'regular_task', {word: 'first'}, function(err, timestamps){
            timestamps.length.should.equal(0);
            done();
          });
        });
      });
    });
  });

  it('I can remove and stop a recurring task', function(done){
    // enqueue the delayed job 2x, one in each type of queue
    api.tasks.enqueue('periodic_task', {}, function(err){
      api.tasks.enqueueIn(1000, 'periodic_task', {}, function(err){
        api.tasks.stopRecurrentJob('periodic_task', function(err, count){
          count.should.equal(2);
          done();
        });
      });
    });
  });

  describe('full worker flow', function(done){

    it('normal tasks work', function(done){
      api.tasks.enqueue('regular_task', {word: 'first'}, function(err){
        api.config.tasks.queues = ['*'];
        api.resque.startWorkers(function(){
          setTimeout(function(){
            taskOutput[0].should.equal('first');
            done();
          }, 500);
        });
      });
    });

    it('delayed tasks work', function(done){
      api.tasks.enqueueIn(100, 'regular_task', {word: 'delayed'}, function(err){
        api.config.tasks.queues = ['*'];
        api.config.tasks.scheduler = true;
        api.resque.startScheduler(function(){
          api.resque.startWorkers(function(){
            setTimeout(function(){
              taskOutput[0].should.equal('delayed');
              done();
            }, 1500);
          });
        });
      });
    });

    it('recurrent tasks work', function(done){
      api.tasks.enqueueRecurrentJob('periodic_task', function(){
        api.config.tasks.queues = ['*'];
        api.config.tasks.scheduler = true;
        api.resque.startScheduler(function(){
          api.resque.startWorkers(function(){
            setTimeout(function(){
              taskOutput[0].should.equal('periodic_task');
              taskOutput[1].should.equal('periodic_task');
              taskOutput[2].should.equal('periodic_task');
              // the task may have run more than 3 times, we just want to ensure that it happened more than once
              done();
            }, 1500);
          });
        });
      });
    });

    it('popping an unknown job will throw an error, but not crash the server', function(done){
      api.resque.queue.enqueue(queue, 'someCrazyTask', {}, function(){
        api.config.tasks.queues = ['*'];
        api.resque.startWorkers(function(){
          var listener = function(queue, job, error){
            queue.should.equal(queue);
            job.class.should.equal('someCrazyTask')
            job.queue.should.equal('testQueue')
            String(error).should.equal('Error: No job defined for class \'someCrazyTask\'');
            api.resque.workers[0].removeListener('error', listener);
            done();
          }

          api.resque.workers[0].on('error', listener);
        });
      });
    });

  });

});
