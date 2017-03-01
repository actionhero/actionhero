'use strict'

var chai = require('chai')
var dirtyChai = require('dirty-chai')
var expect = chai.expect
chai.use(dirtyChai)

let path = require('path')
var ActionheroPrototype = require(path.join(__dirname, '/../../actionhero.js'))
var actionhero = new ActionheroPrototype()
var api

var taskOutput = []
var queue = 'testQueue'

describe('Core: Tasks', () => {
  before((done) => {
    actionhero.start((error, a) => {
      expect(error).to.be.null()
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

  after((done) => {
    delete api.tasks.tasks.regularTask
    delete api.tasks.tasks.periodicTask
    delete api.tasks.tasks.slowTask
    delete api.tasks.jobs.regularTask
    delete api.tasks.jobs.periodicTask
    delete api.tasks.jobs.slowTask

    api.config.tasks.queues = []

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
    expect(response).to.equal(false)
    done()
  })

  it('will clear crashed workers when booting') // TODO

  it('setup worked', (done) => {
    expect(Object.keys(api.tasks.tasks)).to.have.length(3 + 1)
    done()
  })

  it('all queues should start empty', (done) => {
    api.resque.queue.length(queue, (error, length) => {
      expect(error).to.be.null()
      expect(length).to.equal(0)
      done()
    })
  })

  it('can run a task manually', (done) => {
    api.specHelper.runTask('regularTask', {word: 'theWord'}, () => {
      expect(taskOutput[0]).to.equal('theWord')
      done()
    })
  })

  it('no delayed tasks should be scheduled', (done) => {
    api.resque.queue.scheduledAt(queue, 'periodicTask', {}, (error, timestamps) => {
      expect(error).to.be.null()
      expect(timestamps).to.have.length(0)
      done()
    })
  })

  it('all periodic tasks can be enqueued at boot', (done) => {
    api.tasks.enqueueAllRecurrentJobs((error) => {
      expect(error).to.be.null()
      api.resque.queue.length(queue, (error, length) => {
        expect(error).to.be.null()
        expect(length).to.equal(1)
        done()
      })
    })
  })

  it('re-enqueuing a periodic task should not enqueue it again', (done) => {
    api.tasks.enqueue('periodicTask', (error) => {
      expect(error).to.be.null()
      api.tasks.enqueue('periodicTask', (error) => {
        expect(error).to.be.null()
        api.resque.queue.length(queue, (error, length) => {
          expect(error).to.be.null()
          expect(length).to.equal(1)
          done()
        })
      })
    })
  })

  it('can add a normal job', (done) => {
    api.tasks.enqueue('regularTask', {word: 'first'}, (error) => {
      expect(error).to.be.null()
      api.resque.queue.length(queue, (error, length) => {
        expect(error).to.be.null()
        expect(length).to.equal(1)
        done()
      })
    })
  })

  it('can add a delayed job', (done) => {
    var time = new Date().getTime() + 1000
    api.tasks.enqueueAt(time, 'regularTask', {word: 'first'}, (error) => {
      expect(error).to.be.null()
      api.resque.queue.scheduledAt(queue, 'regularTask', {word: 'first'}, (error, timestamps) => {
        expect(error).to.be.null()
        expect(timestamps).to.have.length(1)
        var completeTime = Math.floor(time / 1000)
        expect(Number(timestamps[0])).to.be.at.least(completeTime)
        expect(Number(timestamps[0])).to.be.at.most(completeTime + 2)
        done()
      })
    })
  })

  it('can see enqueued timestmps & see jobs within those timestamps (single + batch)', (done) => {
    var time = new Date().getTime() + 1000
    var roundedTime = Math.round(time / 1000) * 1000
    api.tasks.enqueueAt(time, 'regularTask', {word: 'first'}, (error) => {
      expect(error).to.be.null()
      api.tasks.timestamps((error, timestamps) => {
        expect(error).to.be.null()
        expect(timestamps).to.have.length(1)
        expect(timestamps[0]).to.equal(roundedTime)

        api.tasks.delayedAt(roundedTime, (error, tasks) => {
          expect(error).to.be.null()
          expect(tasks).to.have.length(1)
          expect(tasks[0]['class']).to.equal('regularTask')
        })

        api.tasks.allDelayed((error, allTasks) => {
          expect(error).to.be.null()
          expect(Object.keys(allTasks)).to.have.length(1)
          expect(Object.keys(allTasks)[0]).to.equal(String(roundedTime))
          expect(allTasks[roundedTime][0]['class']).to.equal('regularTask')
          done()
        })
      })
    })
  })

  it('I can remove an enqueued job', (done) => {
    api.tasks.enqueue('regularTask', {word: 'first'}, (error) => {
      expect(error).to.be.null()
      api.resque.queue.length(queue, (error, length) => {
        expect(error).to.be.null()
        expect(length).to.equal(1)
        api.tasks.del(queue, 'regularTask', {word: 'first'}, (error, count) => {
          expect(error).to.be.null()
          expect(count).to.equal(1)
          api.resque.queue.length(queue, (error, length) => {
            expect(error).to.be.null()
            expect(length).to.equal(0)
            done()
          })
        })
      })
    })
  })

  it('I can remove a delayed job', (done) => {
    api.tasks.enqueueIn(1000, 'regularTask', {word: 'first'}, (error) => {
      expect(error).to.be.null()
      api.resque.queue.scheduledAt(queue, 'regularTask', {word: 'first'}, (error, timestamps) => {
        expect(error).to.be.null()
        expect(timestamps).to.have.length(1)
        api.tasks.delDelayed(queue, 'regularTask', {word: 'first'}, (error, timestamps) => {
          expect(error).to.be.null()
          expect(timestamps).to.have.length(1)
          api.tasks.delDelayed(queue, 'regularTask', {word: 'first'}, (error, timestamps) => {
            expect(error).to.be.null()
            expect(timestamps).to.have.length(0)
            done()
          })
        })
      })
    })
  })

  it('I can remove and stop a recurring task', (done) => {
    // enqueue the delayed job 2x, one in each type of queue
    api.tasks.enqueue('periodicTask', {}, (error) => {
      expect(error).to.be.null()
      api.tasks.enqueueIn(1000, 'periodicTask', {}, (error) => {
        expect(error).to.be.null()
        api.tasks.stopRecurrentJob('periodicTask', (error, count) => {
          expect(error).to.be.null()
          expect(count).to.equal(2)
          done()
        })
      })
    })
  })

  describe('details view in a working system', () => {
    it('can use api.tasks.details to learn about the system', (done) => {
      api.config.tasks.queues = ['*']

      api.tasks.enqueue('slowTask', {a: 1}, (error) => {
        expect(error).to.be.null()
        api.resque.multiWorker.start(() => {
          setTimeout(() => {
            api.tasks.details((error, details) => {
              expect(error).to.be.null()
              expect(Object.keys(details.queues)).to.deep.equal(['testQueue'])
              expect(details.queues.testQueue).to.have.length(0)
              expect(Object.keys(details.workers)).to.have.length(1)
              var workerName = Object.keys(details.workers)[0]
              expect(details.workers[workerName].queue).to.equal('testQueue')
              expect(details.workers[workerName].payload.args).to.deep.equal([{a: 1}])
              expect(details.workers[workerName].payload['class']).to.equal('slowTask')
              api.resque.multiWorker.stop(done)
            })
          }, 2000)
        })
      })
    }).timeout(10000)
  })

  describe('full worker flow', () => {
    it('normal tasks work', (done) => {
      api.tasks.enqueue('regularTask', {word: 'first'}, (error) => {
        expect(error).to.be.null()
        api.config.tasks.queues = ['*']
        api.resque.multiWorker.start(() => {
          setTimeout(() => {
            expect(taskOutput[0]).to.equal('first')
            api.resque.multiWorker.stop(done)
          }, 500)
        })
      })
    })

    it('delayed tasks work', (done) => {
      api.tasks.enqueueIn(100, 'regularTask', {word: 'delayed'}, (error) => {
        expect(error).to.be.null()
        api.config.tasks.queues = ['*']
        api.config.tasks.scheduler = true
        api.resque.startScheduler(() => {
          api.resque.multiWorker.start(() => {
            setTimeout(() => {
              expect(taskOutput[0]).to.equal('delayed')
              api.resque.multiWorker.stop(done)
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
              expect(taskOutput[0]).to.equal('periodicTask')
              expect(taskOutput[1]).to.equal('periodicTask')
              expect(taskOutput[2]).to.equal('periodicTask')
              // the task may have run more than 3 times, we just want to ensure that it happened more than once
              api.resque.multiWorker.stop(done)
            }, 1500)
          })
        })
      })
    })

    it('popping an unknown job will throw an error, but not crash the server', (done) => {
      api.config.tasks.queues = ['*']

      var listener = (workerId, queue, job, f) => {
        expect(queue).to.equal(queue)
        expect(job['class']).to.equal('someCrazyTask')
        expect(job.queue).to.equal('testQueue')
        expect(String(f)).to.equal('Error: No job defined for class "someCrazyTask"')
        api.resque.multiWorker.removeListener('failure', listener)
        api.resque.multiWorker.stop(done)
      }

      api.resque.multiWorker.on('failure', listener)

      api.resque.queue.enqueue(queue, 'someCrazyTask', {}, () => {
        api.resque.multiWorker.start()
      })
    })
  })
})
