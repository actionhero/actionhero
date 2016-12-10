'use strict'

let path = require('path')
var ActionheroPrototype = require(path.join(__dirname, '/../../actionhero.js'))
var actionhero = new ActionheroPrototype()
var api

var taskOutput = []
var queue = 'testQueue'

describe('Core: Tasks', () => {
  beforeAll((done) => {
    actionhero.start((error, a) => {
      expect(error).toBeNull()
      api = a

      api.resque.multiWorker.options.minTaskProcessors = 1
      api.resque.multiWorker.options.maxTaskProcessors = 1

      api.tasks.tasks.regularTask = {
        name: 'regular',
        description: 'task: regular',
        queue: queue,
        frequency: 0,
        plugins: [],
        pluginOptions: {},
        run: (api, params, next) => {
          taskOutput.push(params.word)
          next()
        }
      }

      api.tasks.tasks.periodicTask = {
        name: 'periodicTask',
        description: 'task: periodicTask',
        queue: queue,
        frequency: 100,
        plugins: [],
        pluginOptions: {},
        run: (api, params, next) => {
          taskOutput.push('periodicTask')
          next()
        }
      }

      api.tasks.tasks.slowTask = {
        name: 'slowTask',
        description: 'task: slowTask',
        queue: queue,
        frequency: 0,
        plugins: [],
        pluginOptions: {},
        run: (api, params, next) => {
          taskOutput.push('slowTask')
          setTimeout(next, 5000)
        }
      }

      api.tasks.jobs.regularTask = api.tasks.jobWrapper('regularTask')
      api.tasks.jobs.periodicTask = api.tasks.jobWrapper('periodicTask')
      api.tasks.jobs.slowTask = api.tasks.jobWrapper('slowTask')

      done()
    })
  })

  afterAll((done) => {
    delete api.tasks.tasks.regularTask
    delete api.tasks.tasks.periodicTask
    delete api.tasks.tasks.slowTask
    delete api.tasks.jobs.regularTask
    delete api.tasks.jobs.periodicTask
    delete api.tasks.jobs.slowTask

    api.resque.multiWorker.options.minTaskProcessors = 0
    api.resque.multiWorker.options.maxTaskProcessors = 0

    actionhero.stop(() => {
      done()
    })
  })

  beforeEach((done) => {
    taskOutput = []
    api.resque.queue.connection.redis.flushdb(() => {
      done()
    })
  })

  afterEach((done) => {
    api.resque.stopScheduler(() => {
      api.resque.stopMultiWorker(() => {
        done()
      })
    })
  })

  it('a bad task definition causes an exception', (done) => {
    var badTask = {
      name: 'badTask',
      description: 'task',
      // queue: queue, // No Queue
      frequency: 100,
      plugins: [],
      pluginOptions: {},
      run: (api, params, next) => {
        next()
      }
    }

    var response = api.tasks.validateTask(badTask)
    expect(response).toBe(false)
    done()
  })

  it('will clear crashed workers when booting') // TODO

  it('setup worked', (done) => {
    expect(Object.keys(api.tasks.tasks)).toHaveLength(3 + 1)
    done()
  })

  it('all queues should start empty', (done) => {
    api.resque.queue.length(queue, (error, length) => {
      expect(error).toBeNull()
      expect(length).toBe(0)
      done()
    })
  })

  it('can run a task manually', (done) => {
    api.specHelper.runTask('regularTask', {word: 'theWord'}, () => {
      expect(taskOutput[0]).toBe('theWord')
      done()
    })
  })

  it('no delayed tasks should be scheduled', (done) => {
    api.resque.queue.scheduledAt(queue, 'periodicTask', {}, (error, timestamps) => {
      expect(error).toBeNull()
      expect(timestamps).toHaveLength(0)
      done()
    })
  })

  it('all periodic tasks can be enqueued at boot', (done) => {
    api.tasks.enqueueAllRecurrentJobs((error) => {
      expect(error).toBeNull()
      api.resque.queue.length(queue, (error, length) => {
        expect(error).toBeNull()
        expect(length).toBe(1)
        done()
      })
    })
  })

  it('re-enqueuing a periodic task should not enqueue it again', (done) => {
    api.tasks.enqueue('periodicTask', (error) => {
      expect(error).toBeNull()
      api.tasks.enqueue('periodicTask', (error) => {
        expect(error).toBeNull()
        api.resque.queue.length(queue, (error, length) => {
          expect(error).toBeNull()
          expect(length).toBe(1)
          done()
        })
      })
    })
  })

  it('can add a normal job', (done) => {
    api.tasks.enqueue('regularTask', {word: 'first'}, (error) => {
      expect(error).toBeNull()
      api.resque.queue.length(queue, (error, length) => {
        expect(error).toBeNull()
        expect(length).toBe(1)
        done()
      })
    })
  })

  it('can add a delayed job', (done) => {
    var time = new Date().getTime() + 1000
    api.tasks.enqueueAt(time, 'regularTask', {word: 'first'}, (error) => {
      expect(error).toBeNull()
      api.resque.queue.scheduledAt(queue, 'regularTask', {word: 'first'}, (error, timestamps) => {
        expect(error).toBeNull()
        expect(timestamps).toHaveLength(1)
        var completeTime = Math.floor(time / 1000)
        expect(Number(timestamps[0])).toBeGreaterThanOrEqual(completeTime)
        expect(Number(timestamps[0])).toBeLessThanOrEqual(completeTime + 2)
        done()
      })
    })
  })

  it('can see enqueued timestmps & see jobs within those timestamps (single + batch)', (done) => {
    var time = new Date().getTime() + 1000
    var roundedTime = Math.round(time / 1000) * 1000
    api.tasks.enqueueAt(time, 'regularTask', {word: 'first'}, (error) => {
      expect(error).toBeNull()
      api.tasks.timestamps((error, timestamps) => {
        expect(error).toBeNull()
        expect(timestamps).toHaveLength(1)
        expect(timestamps[0]).toBe(roundedTime)

        api.tasks.delayedAt(roundedTime, (error, tasks) => {
          expect(error).toBeNull()
          expect(tasks).toHaveLength(1)
          expect(tasks[0]['class']).toBe('regularTask')
        })

        api.tasks.allDelayed((error, allTasks) => {
          expect(error).toBeNull()
          expect(Object.keys(allTasks)).toHaveLength(1)
          expect(Object.keys(allTasks)[0]).toBe(String(roundedTime))
          expect(allTasks[roundedTime][0]['class']).toBe('regularTask')
          done()
        })
      })
    })
  })

  it('I can remove an enqueued job', (done) => {
    api.tasks.enqueue('regularTask', {word: 'first'}, (error) => {
      expect(error).toBeNull()
      api.resque.queue.length(queue, (error, length) => {
        expect(error).toBeNull()
        expect(length).toBe(1)
        api.tasks.del(queue, 'regularTask', {word: 'first'}, (error, count) => {
          expect(error).toBeNull()
          expect(count).toBe(1)
          api.resque.queue.length(queue, (error, length) => {
            expect(error).toBeNull()
            expect(length).toBe(0)
            done()
          })
        })
      })
    })
  })

  it('I can remove a delayed job', (done) => {
    api.tasks.enqueueIn(1000, 'regularTask', {word: 'first'}, (error) => {
      expect(error).toBeNull()
      api.resque.queue.scheduledAt(queue, 'regularTask', {word: 'first'}, (error, timestamps) => {
        expect(error).toBeNull()
        expect(timestamps).toHaveLength(1)
        api.tasks.delDelayed(queue, 'regularTask', {word: 'first'}, (error, timestamps) => {
          expect(error).toBeNull()
          expect(timestamps).toHaveLength(1)
          api.tasks.delDelayed(queue, 'regularTask', {word: 'first'}, (error, timestamps) => {
            expect(error).toBeNull()
            expect(timestamps).toHaveLength(0)
            done()
          })
        })
      })
    })
  })

  it('I can remove and stop a recurring task', (done) => {
    // enqueue the delayed job 2x, one in each type of queue
    api.tasks.enqueue('periodicTask', {}, (error) => {
      expect(error).toBeNull()
      api.tasks.enqueueIn(1000, 'periodicTask', {}, (error) => {
        expect(error).toBeNull()
        api.tasks.stopRecurrentJob('periodicTask', (error, count) => {
          expect(error).toBeNull()
          expect(count).toBe(2)
          done()
        })
      })
    })
  })

  describe('details view in a working system', () => {
    it('can use api.tasks.details to learn about the system', (done) => {
      api.config.tasks.queues = ['*']

      api.tasks.enqueue('slowTask', {a: 1}, (error) => {
        expect(error).toBeNull()
        api.resque.multiWorker.start(() => {
          setTimeout(() => {
            api.tasks.details((error, details) => {
              expect(error).toBeNull()
              expect(Object.keys(details.queues)).toEqual(['testQueue'])
              expect(details.queues.testQueue).toHaveLength(0)
              expect(Object.keys(details.workers)).toHaveLength(1)
              var workerName = Object.keys(details.workers)[0]
              expect(details.workers[workerName].queue).toBe('testQueue')
              expect(details.workers[workerName].payload.args).toEqual([{a: 1}])
              expect(details.workers[workerName].payload['class']).toBe('slowTask')
              setTimeout(done, 5000)
            })
          }, 2000)
        })
      })
    }, 10000)
  })

  describe('full worker flow', () => {
    it('normal tasks work', (done) => {
      api.tasks.enqueue('regularTask', {word: 'first'}, (error) => {
        expect(error).toBeNull()
        api.config.tasks.queues = ['*']
        api.resque.multiWorker.start(() => {
          setTimeout(() => {
            expect(taskOutput[0]).toBe('first')
            done()
          }, 500)
        })
      })
    })

    it('delayed tasks work', (done) => {
      api.tasks.enqueueIn(100, 'regularTask', {word: 'delayed'}, (error) => {
        expect(error).toBeNull()
        api.config.tasks.queues = ['*']
        api.config.tasks.scheduler = true
        api.resque.startScheduler(() => {
          api.resque.multiWorker.start(() => {
            setTimeout(() => {
              expect(taskOutput[0]).toBe('delayed')
              done()
            }, 1500)
          })
        })
      })
    })

    it('recurrent tasks work', (done) => {
      api.tasks.enqueueRecurrentJob('periodicTask', () => {
        api.config.tasks.queues = ['*']
        api.config.tasks.scheduler = true
        api.resque.startScheduler(() => {
          api.resque.multiWorker.start(() => {
            setTimeout(() => {
              expect(taskOutput[0]).toBe('periodicTask')
              expect(taskOutput[1]).toBe('periodicTask')
              expect(taskOutput[2]).toBe('periodicTask')
              // the task may have run more than 3 times, we just want to ensure that it happened more than once
              done()
            }, 1500)
          })
        })
      })
    })

    it('popping an unknown job will throw an error, but not crash the server', (done) => {
      api.config.tasks.queues = ['*']

      var listener = (workerId, queue, job, f) => {
        expect(queue).toBe(queue)
        expect(job['class']).toBe('someCrazyTask')
        expect(job.queue).toBe('testQueue')
        expect(String(f)).toBe('Error: No job defined for class "someCrazyTask"')
        api.resque.multiWorker.removeListener('failure', listener)
        done()
      }

      api.resque.multiWorker.on('failure', listener)

      api.resque.queue.enqueue(queue, 'someCrazyTask', {}, () => {
        api.resque.multiWorker.start()
      })
    })
  })
})
