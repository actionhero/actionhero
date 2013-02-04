describe('Core: Tasks', function(){
  var specHelper = require('../helpers/specHelper.js').specHelper;
  var apiObj = {};
  var rawAPI = {};
  var should = require("should");
  var taskOutput = [];

  before(function(done){
    this.timeout(10000)
    specHelper.stopServer(0, function(api){ 
      specHelper.prepare(0, function(api){ 
        rawAPI = api;
        apiObj = specHelper.cleanAPIObject(api);

        setTimeout(function(){

          rawAPI.tasks.taskProcessors.forEach(function(taskProcessor){
            taskProcessor.stop();
          });

          rawAPI.tasks.tasks['regular_any'] = {
            name: 'regular_any',
            description: 'task: ' + this.name,
            scope: 'any',
            frequency: 0,
            run: function(api, params, next){
              taskOutput.push(params.word);
              next();
            }
          }

          rawAPI.tasks.tasks['regular_all'] = {
            name: 'regular_all',
            description: 'task: ' + this.name,
            scope: 'all',
            frequency: 0,
            run: function(api, params, next){
              taskOutput.push(params.word);
              next();
            }
          }

          rawAPI.tasks.tasks['periodic_any'] = {
            name: 'periodic_any',
            description: 'task: ' + this.name,
            scope: 'any',
            frequency: 1000,
            run: function(api, params, next){
              taskOutput.push(params.word);
              next();
            }
          }

          rawAPI.tasks.tasks['periodic_all'] = {
            name: 'periodic_all',
            description: 'task: ' + this.name,
            scope: 'all',
            frequency: 1000,
            run: function(api, params, next){
              taskOutput.push(params.word);
              next();
            }
          }

          setTimeout(function(){
            // time for the workers to stop
            done();
          }, rawAPI.tasks.cycleTimeMS * 2 + 1);
        }, rawAPI.tasks.cycleTimeMS * 2 + 1);
      });
    });
  });

  after(function(done){
    specHelper.stopServer(0, function(api){ 
      delete rawAPI.tasks.tasks['regular_any'];
      delete rawAPI.tasks.tasks['regular_all'];
      delete rawAPI.tasks.tasks['periodic_any'];
      delete rawAPI.tasks.tasks['periodic_all'];
      done();
    })
  });

  it('setup worked', function(done){
    rawAPI.utils.hashLength(rawAPI.tasks.tasks).should.equal(4 + 1);
    rawAPI.tasks.taskProcessors.length.should.equal(1);
    rawAPI.tasks.taskProcessors.forEach(function(taskProcessor){
      taskProcessor.running.should.equal(false);
    });
    done();
  });

  it('a bad task definition causes an exception', function(done){
    // TODO
    done();
  });

  it('a bad task (no name) definition causes an exception', function(done){
    try{
      var t = new rawAPI.task();
    }catch(e){
      String(e).should.equal("Error: name is required");
      done();
    }
  });

  it('a bad task (unknwon task name) definition causes an exception', function(done){
    try{
      var t = new rawAPI.task({name: 'something_crazy'});
    }catch(e){
      String(e).should.equal("Error: task name, something_crazy, not found");
      done();
    }
  });

  it('all queues should start empty', function(done){
    rawAPI.tasks.queueLength(rawAPI.tasks.queues.globalQueue, function(err, globalCount){
      rawAPI.tasks.queueLength(rawAPI.tasks.queues.localQueue, function(err, localCount){
        rawAPI.tasks.queueLength(rawAPI.tasks.queues.processingQueue, function(err, processingCount){
          [globalCount, localCount, processingCount].forEach(function(count){
            count.should.equal(0)
          })
          done();
        });
      });
    });
  });

  it('all perioduc tasks should be enqueued when the server starts', function(done){
    rawAPI.tasks.seedPeriodicTasks(function(){
      rawAPI.tasks.countDelayedTasks(function(err, delayedTasksCount){
        delayedTasksCount.should.equal(2); 
        done();
      });
    });
  });

  it('re-enquing a periodc task should fail (if it exists alread) via loader', function(done){
    rawAPI.tasks.seedPeriodicTasks(function(){
      rawAPI.tasks.countDelayedTasks(function(err, delayedTasksCount){
        delayedTasksCount.should.equal(2); // no change
        done();
      });
    });
  });

  it('re-enquing a periodc task should fail (if it exists alread) via direct enqueue', function(done){
    var t = new rawAPI.task({name: 'periodic_any'});
    t.enqueue(function(err, success){
      String(err).should.equal('Error: not enquing periodic task periodic_any: already in the queue');
      done();
    })
  });

   it('I can inspect the state of my current tasks, the local queue, and the global queue', function(done){
    rawAPI.tasks.getAllTasks(function(err, data){
      for(var i in data){
        var t = data[i];
        ( (['periodic_any', 'periodic_all'].indexOf(t.name) >= 0) ).should.be.true;
        t.periodic.should.equal(true);
        t.frequency.should.equal(1000);
        t.queue.indexOf('actionHero:tasks:delayed').should.equal(0);
        t.state.should.equal('delayed');
      }
      done();
    })
  });

  it('I can add many non-periodic task instances', function(done){
    var t = new rawAPI.task({name: 'regular_any'});
    t.enqueue(function(){
      var t = new rawAPI.task({name: 'regular_any'});
      t.enqueue(function(){
        rawAPI.tasks.queueLength(rawAPI.tasks.queues.globalQueue, function(err, globalCount){
          globalCount.should.equal(2);
          rawAPI.tasks.getAllTasks(function(err, data){
            rawAPI.utils.hashLength(data).should.equal(4)
            done();
          });
        });
      });
    });
  });

  // TODO
  // it('If I crash while working on a task, I will clear the crash on my next boot', function(done){
  //   rawAPI.redis.client.flushdb(function(){
  //     var t = new rawAPI.task({name: 'regular_any', runAt: new Date().getTime() - 1});
  //     t.enqueue(function(err, success){
  //       success.should.equal(true);
  //       rawAPI.tasks.queueLength(rawAPI.tasks.queues.globalQueue, function(err, globalCount){
  //         globalCount.should.equal(1);
  //         rawAPI.tasks.changeQueue(rawAPI.tasks.queues.globalQueue, rawAPI.tasks.queues.processingQueue, function(err, task){
  //           task.name.should.equal('regular_any')
  //           rawAPI.tasks.setTaskData(task.id, {api_id: rawAPI.id, worker_id: 0, state: "processing"}, function(err, task){
  //             task.queue.should.equal('actionHero:tasks:processing')
  //             rawAPI.tasks.queueLength(rawAPI.tasks.queues.globalQueue, function(err, globalCount2){
  //               globalCount2.should.equal(0)
              
  //               rawAPI.tasks.savePreviouslyCrashedTasks(function(){
  //                 rawAPI.tasks.queueLength(rawAPI.tasks.queues.globalQueue, function(err, globalCount3){
  //                   globalCount3.should.equal(1);
  //                   done();
  //                 });
  //               });

  //             });
  //           });
  //         });
  //       });
  //     });
  //   });
  // });

  describe('busted periodic task', function(){

    if(specHelper.canUseDomains){

      var uncaughtExceptionHandlers;

      before(function(done){
        rawAPI.tasks.tasks['busted_task'] = {
          name: 'busted_task',
          description: 'task: ' + this.name,
          scope: 'any',
          frequency: 1,
          run: function(api, params, next){
            stuff = bad + thing;
            next();
          }
        }

        uncaughtExceptionHandlers = process.listeners("uncaughtException");
        uncaughtExceptionHandlers.forEach(function(e){
          process.removeListener("uncaughtException", e); 
        });

        rawAPI.redis.client.flushdb(function(){
          done();
        });
      });

      after(function(done){
        delete rawAPI.tasks.tasks['busted_task'];
        uncaughtExceptionHandlers.forEach(function(e){
          process.on("uncaughtException", e);
        });
        done()
      });

      it('periodc tasks which return a failure will still be re-enqueued and tried again', function(done){
        var worker = new rawAPI.taskProcessor({id: 1});
        var task = new rawAPI.task({name: 'busted_task'});
        task.enqueue(function(err, resp){
          setTimeout(function(){
            rawAPI.tasks.countDelayedTasks(function(err, delayedCount){
              delayedCount.should.equal(1);
              worker.process(function(){
                // move to global
                rawAPI.tasks.queueLength(rawAPI.tasks.queues.globalQueue, function(err, globalCount){
                  globalCount.should.equal(1);
                  worker.process(function(){
                    // move to local
                    rawAPI.tasks.queueLength(rawAPI.tasks.queues.localQueue, function(err, localCount){
                      localCount.should.equal(1);
                      worker.process(function(){
                        // move to processing and try to work it
                        // should be back in delayed
                        rawAPI.tasks.queueLength(rawAPI.tasks.queues.processingQueue, function(err, processingCount){
                          rawAPI.tasks.countDelayedTasks(function(err, delayedCount2){
                            rawAPI.tasks.queueLength(rawAPI.tasks.queues.localQueue, function(err, localCount2){
                              rawAPI.tasks.queueLength(rawAPI.tasks.queues.globalQueue, function(err, globalCount2){
                                processingCount.should.equal(0);
                                globalCount2.should.equal(0);
                                localCount2.should.equal(0);
                                delayedCount2.should.equal(1);
                                done();
                              });
                            });
                          });
                        });
                      });
                    });
                  });
                });
              }); 
            });
          }, 2);
        });
      });

    }else{
      console.log("skipping restart test as it requires domains, and node.js >= 0.8.0")
    }

  });

  it('enquing an "all" task will end up preformed by every server', function(done){
    // TODO
    done();
  });

  it('I will not process tasks with a runAt in the future', function(done){
    this.timeout(5000);
    rawAPI.redis.client.flushdb(function(){
      var worker = new rawAPI.taskProcessor({id: 1});
      var task = new rawAPI.task({name: 'regular_any', runAt: new Date().getTime() + 10000});
      task.enqueue(function(){
        rawAPI.tasks.countDelayedTasks(function(err, delayedCount){
          delayedCount.should.equal(1);
          setTimeout(function(){
            worker.process(function(){
              rawAPI.tasks.countDelayedTasks(function(err, delayedCount2){
                delayedCount.should.equal(1);
                done();
              });
            });
          }, 500)
        });
      });
    });
  });

  it('tasks can be passed params and taskWorkers can work on thier own', function(done){
    this.timeout(10000)
    taskOutput = [];
    rawAPI.redis.client.flushdb(function(){
      var worker = new rawAPI.taskProcessor({id: 1});
      var task = new rawAPI.task({name: 'regular_any', params: {word: 'TEST'}});
      task.enqueue(function(){
        worker.start();
        setTimeout(function(){
          taskOutput[0].should.equal('TEST');
          worker.stop();
          done();
        }, rawAPI.tasks.cycleTimeMS * 2 + 1)
      });
    });
  });

});