'use strict'

const path = require('path')
const ActionHero = require(path.join(__dirname, '/../../index.js'))
const actionhero = new ActionHero.Process()
let api

let taskOutput = []
const queue = 'testQueue'

describe('Core: Tasks', () => {
  beforeAll(async () => {
    api = await actionhero.start()

    api.resque.multiWorker.options.minTaskProcessors = 1
    api.resque.multiWorker.options.maxTaskProcessors = 1

    class RegularTask extends ActionHero.Task {
      constructor () {
        super()
        this.name = 'regular'
        this.description = 'task: regular'
        this.queue = queue
        this.frequency = 0
      }

      run (params) {
        taskOutput.push(params.word)
        return params.word
      }
    }

    class PeriodicTask extends ActionHero.Task {
      constructor () {
        super()
        this.name = 'periodicTask'
        this.description = 'task: periodicTask'
        this.queue = queue
        this.frequency = 100
      }

      run (params) {
        taskOutput.push('periodicTask')
        return 'periodicTask'
      }
    }

    class SlowTask extends ActionHero.Task {
      constructor () {
        super()
        this.name = 'slowTask'
        this.description = 'task: slowTask'
        this.queue = queue
        this.frequency = 0
      }

      async run (params) {
        await api.utils.sleep(5000)
        taskOutput.push('slowTask')
        return 'slowTask'
      }
    }

    api.tasks.tasks.regularTask = new RegularTask()
    api.tasks.tasks.periodicTask = new PeriodicTask()
    api.tasks.tasks.slowTask = new SlowTask()

    api.tasks.jobs.regularTask = api.tasks.jobWrapper('regularTask')
    api.tasks.jobs.periodicTask = api.tasks.jobWrapper('periodicTask')
    api.tasks.jobs.slowTask = api.tasks.jobWrapper('slowTask')
  })

  afterAll(async () => {
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

  test('validates tasks', () => {
    api.tasks.tasks.regularTask.validate()
  })

  test('a bad task definition causes an exception', () => {
    class BadTask extends ActionHero.Task {
      constructor () {
        super()
        // this.name = 'noName'
        this.description = 'no name'
        this.queue = queue
        this.frequency = 0
      }

      async run (params) {}
    }

    const task = new BadTask()

    try {
      task.validate()
      throw new Error('should not get here')
    } catch (error) {
      expect(error.toString()).toMatch(/name is required for this task/)
    }
  })

  test(
    'tasks can have a number or a method which returns a number as frequency',
    async () => {
      class FreqFuncTask extends ActionHero.Task {
        constructor () {
          super()
          this.name = 'freqFuncTask'
          this.description = 'freqFuncTask'
          this.queue = queue
        }

        frequency () { return 1 + 2 + 3 }

        run (params) { return 'yay' }
      }

      const task = new FreqFuncTask()
      task.validate() // should not throw
      expect(task.name).toEqual('freqFuncTask')
      expect(task.frequency).toEqual(6)
    }
  )

  // test('will clear crashed workers when booting') // TODO

  test('setup worked', () => {
    expect(Object.keys(api.tasks.tasks)).toHaveLength(3 + 1)
  })

  test('all queues should start empty', async () => {
    const length = await api.resque.queue.length()
    expect(length).toEqual(0)
  })

  test('can run a task manually', async () => {
    const response = await api.specHelper.runTask('regularTask', { word: 'theWord' })
    expect(response).toEqual('theWord')
    expect(taskOutput[0]).toEqual('theWord')
  })

  test('can run a task fully', async () => {
    const response = await api.specHelper.runFullTask('regularTask', { word: 'theWord' })
    expect(response).toEqual('theWord')
    expect(taskOutput[0]).toEqual('theWord')
  })

  test('can call task methods inside the run', async () => {
    class TaskWithMethod extends ActionHero.Task {
      constructor () {
        super()
        this.name = 'taskWithMethod'
        this.description = 'task with additional methods to execute in run'
        this.queue = queue
      }

      async stepOne () {
        await api.utils.sleep(100)
        taskOutput.push('one')
      }

      stepTwo () {
        taskOutput.push('two')
      }

      async run () {
        await this.stepOne()
        this.stepTwo()
        taskOutput.push('tree')
      }
    }
    api.tasks.tasks.taskWithMethod = new TaskWithMethod()
    api.tasks.jobs.taskWithMethod = api.tasks.jobWrapper('taskWithMethod')
    await api.specHelper.runFullTask('taskWithMethod', {})
    expect(taskOutput).toHaveLength(3)
    expect(taskOutput[0]).toEqual('one')
    expect(taskOutput[1]).toEqual('two')
    expect(taskOutput[2]).toEqual('tree')
  })

  test('no delayed tasks should be scheduled', async () => {
    const timestamps = await api.resque.queue.scheduledAt(queue, 'periodicTask', {})
    expect(timestamps).toHaveLength(0)
  })

  test('all periodic tasks can be enqueued at boot', async () => {
    await api.tasks.enqueueAllRecurrentTasks()
    const length = await api.resque.queue.length(queue)
    expect(length).toEqual(1)
  })

  test('re-enqueuing a periodic task should not enqueue it again', async () => {
    const tryOne = await api.tasks.enqueue('periodicTask')
    const tryTwo = await api.tasks.enqueue('periodicTask')
    const length = await api.resque.queue.length(queue)
    expect(tryOne).toEqual(true)
    expect(tryTwo).toEqual(false)
    expect(length).toEqual(1)
  })

  test('can add a normal job', async () => {
    await api.tasks.enqueue('regularTask', { word: 'first' })
    const length = await api.resque.queue.length(queue)
    expect(length).toEqual(1)
  })

  test('can add a delayed job', async () => {
    const time = new Date().getTime() + 1000
    await api.tasks.enqueueAt(time, 'regularTask', { word: 'first' })
    const timestamps = await api.resque.queue.scheduledAt(queue, 'regularTask', { word: 'first' })
    expect(timestamps).toHaveLength(1)

    const completeTime = Math.floor(time / 1000)
    expect(Number(timestamps[0])).toBeGreaterThanOrEqual(completeTime)
    expect(Number(timestamps[0])).toBeLessThan(completeTime + 2)
  })

  test(
    'can see enqueued timestmps & see jobs within those timestamps (single + batch)',
    async () => {
      const time = new Date().getTime() + 1000
      const roundedTime = Math.round(time / 1000) * 1000

      await api.tasks.enqueueAt(time, 'regularTask', { word: 'first' })
      const timestamps = await api.tasks.timestamps()
      expect(timestamps).toHaveLength(1)
      expect(timestamps[0]).toEqual(roundedTime)

      const { tasks } = await api.tasks.delayedAt(roundedTime)
      expect(tasks).toHaveLength(1)
      expect(tasks[0].class).toEqual('regularTask')

      const allTasks = await api.tasks.allDelayed()
      expect(Object.keys(allTasks)).toHaveLength(1)
      expect(Object.keys(allTasks)[0]).toEqual(String(roundedTime))
      expect(allTasks[roundedTime][0].class).toEqual('regularTask')
    }
  )

  test('I can remove an enqueued job', async () => {
    await api.tasks.enqueue('regularTask', { word: 'first' })
    const length = await api.resque.queue.length(queue)
    expect(length).toEqual(1)

    const count = await api.tasks.del(queue, 'regularTask', { word: 'first' })
    expect(count).toEqual(1)

    const lengthAgain = await api.resque.queue.length()
    expect(lengthAgain).toEqual(0)
  })

  test('I can remove a delayed job', async () => {
    await api.tasks.enqueueIn(1000, 'regularTask', { word: 'first' })
    const timestamps = await api.resque.queue.scheduledAt(queue, 'regularTask', { word: 'first' })
    expect(timestamps).toHaveLength(1)

    const timestampsDeleted = await api.tasks.delDelayed(queue, 'regularTask', { word: 'first' })
    expect(timestampsDeleted).toHaveLength(1)
    expect(timestampsDeleted).toEqual(timestamps)

    const timestampsDeletedAgain = await api.tasks.delDelayed(queue, 'regularTask', { word: 'first' })
    expect(timestampsDeletedAgain).toHaveLength(0)
  })

  test('I can remove and stop a recurring task', async () => {
    // enqueue the delayed job 2x, one in each type of queue
    await api.tasks.enqueue('periodicTask')
    await api.tasks.enqueueIn(1000, 'periodicTask')

    const count = await api.tasks.stopRecurrentTask('periodicTask')
    expect(count).toEqual(2)
  })

  describe('middleware', () => {
    describe('enqueue modification', () => {
      beforeAll(async () => {
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
          run: (params, worker) => {
            throw new Error('Should never get here')
          }
        }

        api.tasks.jobs.middlewareTask = api.tasks.jobWrapper('middlewareTask')
      })

      afterAll(async () => {
        api.tasks.globalMiddleware = []
        delete api.tasks.jobs.middlewareTask
      })

      test(
        'can modify the behavior of enqueue with middleware.preEnqueue',
        async () => {
          try {
            await api.tasks.enqueue('middlewareTask', {})
          } catch (error) {
            expect(error.toString()).toEqual('Error: You cannot enqueue me!')
          }
        }
      )
    })

    describe('Pre and Post processing', () => {
      beforeAll(() => {
        const middleware = {
          name: 'test-middleware',
          priority: 1000,
          global: false,
          preProcessor: function () {
            const params = this.args[0]

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
          run: function (params, worker) {
            expect(params.test).toEqual(true)
            const result = worker.result
            result.run = true
            return result
          }
        }

        api.tasks.jobs.middlewareTask = api.tasks.jobWrapper('middlewareTask')
      })

      afterAll(() => {
        api.tasks.globalMiddleware = []
        delete api.tasks.jobs.middlewareTask
      })

      test(
        'can modify parameters before a task and modify result after task completion',
        async () => {
          const result = await api.specHelper.runFullTask('middlewareTask', { foo: 'bar' })
          expect(result.run).toEqual(true)
          expect(result.pre).toEqual(true)
          expect(result.post).toEqual(true)
        }
      )

      test('can prevent the running of a task with error', async () => {
        try {
          await api.specHelper.runFullTask('middlewareTask', { throw: true })
        } catch (error) {
          expect(error.toString()).toEqual('Error: thown!')
        }
      })

      test('can prevent the running of a task with return value', async () => {
        const result = await api.specHelper.runFullTask('middlewareTask', { stop: true })
        expect(result).toBeUndefined()
      })
    })
  })

  describe('details view in a working system', () => {
    test('can use api.tasks.details to learn about the system', async () => {
      api.config.tasks.queues = ['*']

      await api.tasks.enqueue('slowTask', { a: 1 })
      api.resque.multiWorker.start()

      await api.utils.sleep(2000)

      const details = await api.tasks.details()

      expect(Object.keys(details.queues)).toEqual(['testQueue'])
      expect(details.queues.testQueue).toHaveLength(0)
      expect(Object.keys(details.workers)).toHaveLength(1)
      const workerName = Object.keys(details.workers)[0]
      expect(details.workers[workerName].queue).toEqual('testQueue')
      expect(details.workers[workerName].payload.args).toEqual([{ a: 1 }])
      expect(details.workers[workerName].payload.class).toEqual('slowTask')

      await api.resque.multiWorker.stop()
    }, 10000)
  })

  describe('full worker flow', () => {
    test('normal tasks work', async () => {
      await api.tasks.enqueue('regularTask', { word: 'first' })
      api.config.tasks.queues = ['*']
      api.resque.multiWorker.start()

      await api.utils.sleep(500)

      expect(taskOutput[0]).toEqual('first')
      await api.resque.multiWorker.stop()
    })

    test('delayed tasks work', async () => {
      await api.tasks.enqueueIn(100, 'regularTask', { word: 'delayed' })

      api.config.tasks.queues = ['*']
      api.config.tasks.scheduler = true
      await api.resque.startScheduler()
      await api.resque.multiWorker.start()

      await api.utils.sleep(1500)
      expect(taskOutput[0]).toEqual('delayed')
      await api.resque.multiWorker.stop()
      await api.resque.stopScheduler()
    })

    test('recurrent tasks work', async () => {
      await api.tasks.enqueueRecurrentTask('periodicTask')

      api.config.tasks.queues = ['*']
      api.config.tasks.scheduler = true
      await api.resque.startScheduler()
      await api.resque.multiWorker.start()

      await api.utils.sleep(1500)
      expect(taskOutput[0]).toEqual('periodicTask')
      expect(taskOutput[1]).toEqual('periodicTask')
      expect(taskOutput[2]).toEqual('periodicTask')
      // the task may have run more than 3 times, we just want to ensure that it happened more than once
      await api.resque.multiWorker.stop()
      await api.resque.stopScheduler()
    })

    test(
      'trying to run an unknown job will return a failure, but not crash the server',
      async (done) => {
        api.config.tasks.queues = ['*']

        const listener = async (workerId, queue, job, f) => {
          expect(queue).toEqual(queue)
          expect(job.class).toEqual('someCrazyTask')
          expect(job.queue).toEqual('testQueue')
          expect(String(f)).toEqual('Error: No job defined for class "someCrazyTask"')
          api.resque.multiWorker.removeListener('failure', listener)
          await api.resque.multiWorker.stop()
          return done()
        }

        api.resque.multiWorker.on('failure', listener)

        await api.resque.queue.enqueue(queue, 'someCrazyTask')
        api.resque.multiWorker.start()
      }
    )
  })
})
