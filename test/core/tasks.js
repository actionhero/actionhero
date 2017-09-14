'use strict'

const chai = require('chai')
const dirtyChai = require('dirty-chai')
const expect = chai.expect
chai.use(dirtyChai)

const path = require('path')
const ActionheroPrototype = require(path.join(__dirname, '/../../actionhero.js'))
const actionhero = new ActionheroPrototype()
let api

let taskOutput = []
let queue = 'testQueue'

describe('Core: Tasks', () => {
  before(async () => {
    api = await actionhero.start()

    api.resque.multiWorker.options.minTaskProcessors = 1
    api.resque.multiWorker.options.maxTaskProcessors = 1

    api.tasks.tasks.regularTask = {
      name: 'regular',
      description: 'task: regular',
      queue: queue,
      frequency: 0,
      plugins: [],
      pluginOptions: {},
      run: async (api, params) => {
        taskOutput.push(params.word)
        return params.word
      }
    }

    api.tasks.tasks.periodicTask = {
      name: 'periodicTask',
      description: 'task: periodicTask',
      queue: queue,
      frequency: 100,
      plugins: [],
      pluginOptions: {},
      run: async (api, params) => {
        taskOutput.push('periodicTask')
        return 'periodicTask'
      }
    }

    api.tasks.tasks.slowTask = {
      name: 'slowTask',
      description: 'task: slowTask',
      queue: queue,
      frequency: 0,
      plugins: [],
      pluginOptions: {},
      run: async (api, params) => {
        await new Promise((resolve) => { setTimeout(resolve, 5000) })
        taskOutput.push('slowTask')
        return 'slowTask'
      }
    }

    api.tasks.jobs.regularTask = api.tasks.jobWrapper('regularTask')
    api.tasks.jobs.periodicTask = api.tasks.jobWrapper('periodicTask')
    api.tasks.jobs.slowTask = api.tasks.jobWrapper('slowTask')
  })

  after(async () => {
    delete api.tasks.tasks.regularTask
    delete api.tasks.tasks.periodicTask
    delete api.tasks.tasks.slowTask
    delete api.tasks.jobs.regularTask
    delete api.tasks.jobs.periodicTask
    delete api.tasks.jobs.slowTask

    api.config.tasks.queues = []

    api.resque.multiWorker.options.minTaskProcessors = 0
    api.resque.multiWorker.options.maxTaskProcessors = 0

    await actionhero.stop()
  })

  beforeEach(async () => {
    taskOutput = []
    await api.resque.queue.connection.redis.flushdb()
  })

  afterEach(async () => {
    await api.resque.stopScheduler()
    await api.resque.stopMultiWorker()
  })

  it('a bad task definition causes an exception', () => {
    let badTask = {
      name: 'badTask',
      description: 'task',
      // queue: queue, // No Queue
      frequency: 100,
      plugins: [],
      pluginOptions: {},
      run: (api, params) => {}
    }

    let response = api.tasks.validateTask(badTask)
    expect(response).to.equal(false)
  })

  it('will clear crashed workers when booting') // TODO

  it('setup worked', () => {
    expect(Object.keys(api.tasks.tasks)).to.have.length(3 + 1)
  })

  it('all queues should start empty', async () => {
    let length = await api.resque.queue.length()
    expect(length).to.equal(0)
  })

  it('can run a task manually', async () => {
    let response = await api.specHelper.runTask('regularTask', {word: 'theWord'})
    expect(response).to.equal('theWord')
    expect(taskOutput[0]).to.equal('theWord')
  })

  it('can run a task fully', async () => {
    let response = await api.specHelper.runFullTask('regularTask', {word: 'theWord'})
    expect(response).to.equal('theWord')
    expect(taskOutput[0]).to.equal('theWord')
  })

  it('no delayed tasks should be scheduled', async () => {
    let timestamps = await api.resque.queue.scheduledAt(queue, 'periodicTask', {})
    expect(timestamps).to.have.length(0)
  })

  it('all periodic tasks can be enqueued at boot', async () => {
    await api.tasks.enqueueAllRecurrentJobs()
    let length = await api.resque.queue.length(queue)
    expect(length).to.equal(1)
  })

  it('re-enqueuing a periodic task should not enqueue it again', async () => {
    let tryOne = await api.tasks.enqueue('periodicTask')
    let tryTwo = await api.tasks.enqueue('periodicTask')
    let length = await api.resque.queue.length(queue)
    expect(tryOne).to.equal(true)
    expect(tryTwo).to.equal(false)
    expect(length).to.equal(1)
  })

  it('can add a normal job', async () => {
    await api.tasks.enqueue('regularTask', {word: 'first'})
    let length = await api.resque.queue.length(queue)
    expect(length).to.equal(1)
  })

  it('can add a delayed job', async () => {
    let time = new Date().getTime() + 1000
    await api.tasks.enqueueAt(time, 'regularTask', {word: 'first'})
    let timestamps = await api.resque.queue.scheduledAt(queue, 'regularTask', {word: 'first'})
    expect(timestamps).to.have.length(1)

    let completeTime = Math.floor(time / 1000)
    expect(Number(timestamps[0])).to.be.at.least(completeTime)
    expect(Number(timestamps[0])).to.be.at.most(completeTime + 2)
  })

  it('can see enqueued timestmps & see jobs within those timestamps (single + batch)', async () => {
    let time = new Date().getTime() + 1000
    let roundedTime = Math.round(time / 1000) * 1000

    await api.tasks.enqueueAt(time, 'regularTask', {word: 'first'})
    let timestamps = await api.tasks.timestamps()
    expect(timestamps).to.have.length(1)
    expect(timestamps[0]).to.equal(roundedTime)

    let {tasks} = await api.tasks.delayedAt(roundedTime)
    expect(tasks).to.have.length(1)
    expect(tasks[0]['class']).to.equal('regularTask')

    let allTasks = await api.tasks.allDelayed()
    expect(Object.keys(allTasks)).to.have.length(1)
    expect(Object.keys(allTasks)[0]).to.equal(String(roundedTime))
    expect(allTasks[roundedTime][0]['class']).to.equal('regularTask')
  })

  it('I can remove an enqueued job', async () => {
    await api.tasks.enqueue('regularTask', {word: 'first'})
    let length = await api.resque.queue.length(queue)
    expect(length).to.equal(1)

    let count = await api.tasks.del(queue, 'regularTask', {word: 'first'})
    expect(count).to.equal(1)

    let lengthAgain = await api.resque.queue.length()
    expect(lengthAgain).to.equal(0)
  })

  it('I can remove a delayed job', async () => {
    await api.tasks.enqueueIn(1000, 'regularTask', {word: 'first'})
    let timestamps = await api.resque.queue.scheduledAt(queue, 'regularTask', {word: 'first'})
    expect(timestamps).to.have.length(1)

    let timestampsDeleted = await api.tasks.delDelayed(queue, 'regularTask', {word: 'first'})
    expect(timestampsDeleted).to.have.length(1)
    expect(timestampsDeleted).to.deep.equal(timestamps)

    let timestampsDeletedAgain = await api.tasks.delDelayed(queue, 'regularTask', {word: 'first'})
    expect(timestampsDeletedAgain).to.have.length(0)
  })

  it('I can remove and stop a recurring task', async () => {
    // enqueue the delayed job 2x, one in each type of queue
    await api.tasks.enqueue('periodicTask')
    await api.tasks.enqueueIn(1000, 'periodicTask')

    let count = await api.tasks.stopRecurrentJob('periodicTask')
    expect(count).to.equal(2)
  })

  describe('middleware', () => {
    describe('enqueue modification', () => {
      before(async () => {
        const middleware = {
          name: 'test-middleware',
          priority: 1000,
          global: false,
          preEnqueue: () => {
            throw new Error('You cannot enqueue me!')
          }
        }

        api.tasks.addMiddleware(middleware)

        api.tasks.tasks.middlewareTask = {
          name: 'middlewareTask',
          description: 'middlewaretask',
          queue: 'default',
          frequency: 0,
          middleware: ['test-middleware'],
          run: (api, params) => {
            throw new Error('Should never get here')
          }
        }

        api.tasks.jobs.middlewareTask = api.tasks.jobWrapper('middlewareTask')
      })

      after(async () => {
        api.tasks.globalMiddleware = []
        delete api.tasks.jobs.middlewareTask
      })

      it('can modify the behavior of enqueue with middleware.preEnqueue', async () => {
        try {
          await api.tasks.enqueue('middlewareTask', {})
        } catch (error) {
          expect(error.toString()).to.be.equal('Error: You cannot enqueue me!')
        }
      })
    })

    describe('Pre and Post processing', () => {
      before(() => {
        const middleware = {
          name: 'test-middleware',
          priority: 1000,
          global: false,
          preProcessor: function () {
            let params = this.args[0]

            if (params.stop === true) { return false }
            if (params.throw === true) { throw new Error('thown!') }

            params.test = true
            if (!this.worker.result) { this.worker.result = {} }
            this.worker.result.pre = true
            return true
          },
          postProcessor: function () {
            this.worker.result.post = true
            return true
          }
        }

        api.tasks.addMiddleware(middleware)

        api.tasks.tasks.middlewareTask = {
          name: 'middlewareTask',
          description: 'middlewaretask',
          queue: 'default',
          frequency: 0,
          middleware: ['test-middleware'],
          run: function (api, params) {
            expect(params.test).to.equal(true)
            let result = this.result
            result.run = true
            return result
          }
        }

        api.tasks.jobs.middlewareTask = api.tasks.jobWrapper('middlewareTask')
      })

      after(() => {
        api.tasks.globalMiddleware = []
        delete api.tasks.jobs.middlewareTask
      })

      it('can modify parameters before a task and modify result after task completion', async () => {
        const result = await api.specHelper.runFullTask('middlewareTask', {foo: 'bar'})
        expect(result.run).to.equal(true)
        expect(result.pre).to.equal(true)
        expect(result.post).to.equal(true)
      })

      it('can prevent the running of a task with error', async () => {
        try {
          await api.specHelper.runFullTask('middlewareTask', {throw: true})
        } catch (error) {
          expect(error.toString()).to.equal('Error: thown!')
        }
      })

      it('can prevent the running of a task with return value', async () => {
        let result = await api.specHelper.runFullTask('middlewareTask', {stop: true})
        expect(result).to.be.undefined()
      })
    })
  })

  describe('details view in a working system', () => {
    it('can use api.tasks.details to learn about the system', async function () {
      this.timeout(1000 * 10)

      api.config.tasks.queues = ['*']

      await api.tasks.enqueue('slowTask', {a: 1})
      api.resque.multiWorker.start()

      await new Promise((resolve) => { setTimeout(resolve, 2000) })

      let details = await api.tasks.details()

      expect(Object.keys(details.queues)).to.deep.equal(['testQueue'])
      expect(details.queues.testQueue).to.have.length(0)
      expect(Object.keys(details.workers)).to.have.length(1)
      let workerName = Object.keys(details.workers)[0]
      expect(details.workers[workerName].queue).to.equal('testQueue')
      expect(details.workers[workerName].payload.args).to.deep.equal([{a: 1}])
      expect(details.workers[workerName].payload['class']).to.equal('slowTask')

      await api.resque.multiWorker.stop()
    })
  })

  describe('full worker flow', () => {
    it('normal tasks work', async () => {
      await api.tasks.enqueue('regularTask', {word: 'first'})
      api.config.tasks.queues = ['*']
      api.resque.multiWorker.start()

      await new Promise((resolve) => { setTimeout(resolve, 500) })

      expect(taskOutput[0]).to.equal('first')
      await api.resque.multiWorker.stop()
    })

    it('delayed tasks work', async () => {
      await api.tasks.enqueueIn(100, 'regularTask', {word: 'delayed'})

      api.config.tasks.queues = ['*']
      api.config.tasks.scheduler = true
      await api.resque.startScheduler()
      await api.resque.multiWorker.start()

      await new Promise((resolve) => { setTimeout(resolve, 1500) })
      expect(taskOutput[0]).to.equal('delayed')
      await api.resque.multiWorker.stop()
      await api.resque.stopScheduler()
    })

    it('recurrent tasks work', async () => {
      await api.tasks.enqueueRecurrentJob('periodicTask')

      api.config.tasks.queues = ['*']
      api.config.tasks.scheduler = true
      await api.resque.startScheduler()
      await api.resque.multiWorker.start()

      await new Promise((resolve) => { setTimeout(resolve, 1500) })
      expect(taskOutput[0]).to.equal('periodicTask')
      expect(taskOutput[1]).to.equal('periodicTask')
      expect(taskOutput[2]).to.equal('periodicTask')
      // the task may have run more than 3 times, we just want to ensure that it happened more than once
      await api.resque.multiWorker.stop()
      await api.resque.stopScheduler()
    })

    it('trying to run an unknown job will return a failure, but not crash the server', async () => {
      api.config.tasks.queues = ['*']

      await new Promise(async (resolve) => {
        let listener = async (workerId, queue, job, f) => {
          expect(queue).to.equal(queue)
          expect(job['class']).to.equal('someCrazyTask')
          expect(job.queue).to.equal('testQueue')
          expect(String(f)).to.equal('Error: No job defined for class "someCrazyTask"')
          api.resque.multiWorker.removeListener('failure', listener)
          await api.resque.multiWorker.stop()
          resolve()
        }

        api.resque.multiWorker.on('failure', listener)

        await api.resque.queue.enqueue(queue, 'someCrazyTask')
        api.resque.multiWorker.start()
      })
    })
  })
})
