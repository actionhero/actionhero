'use strict'

var chai = require('chai')
var dirtyChai = require('dirty-chai')
var expect = chai.expect
chai.use(dirtyChai)

let path = require('path')
var ActionheroPrototype = require(path.join(__dirname, '/../../actionhero.js'))
var actionhero = new ActionheroPrototype()
var api

var taskParams = {
  foo: 'bar'
}

var middleware = {
  name: 'test-middleware',
  priority: 1000,
  global: false,
  preProcessor: function (next) {
    try {
      var params = this.args[0]
      expect(params).to.equal(taskParams)
      params.test = true
      next()
    } catch (e) {
      next(e)
    }
  },
  postProcessor: function (next) {
    try {
      var worker = this.worker
      var params = this.args[0]
      expect(params.test).to.equal(true) // Requires disableParamScrubbing or that `test` be a valid param
      var result = worker.result
      expect(result.result).to.equal('done')
      result.result = 'fin'

      next(null, result)
    } catch (e) {
      next(e)
    }
  },
  preEnqueue: function (next) {
    var params = this.args[0]
    if (params.invalid) {
      return next(new Error('Invalid Parameter'), false)
    }
    next()
  }
}

describe('Test: Task Middleware', () => {
  before((done) => {
    actionhero.start((error, a) => {
      expect(error).to.be.null()

      api = a

      api.tasks.addMiddleware(middleware)

      api.tasks.tasks.middlewareTask = {
        name: 'middlewareTask',
        description: 'middlewaretask',
        queue: 'default',
        frequency: 0,
        middleware: ['test-middleware'],
        run: function (api, params, next) {
          expect(params.test).to.be.ok()
          next(null, {result: 'done'})
        }
      }

      api.tasks.jobs.middlewareTask = api.tasks.jobWrapper('middlewareTask')

      done()
    })
  })

  after((done) => {
    api.tasks.globalMiddleware = []
    actionhero.stop(done)
  })

  it('can modify parameters before a task and modify result after task completion', (done) => {
    api.specHelper.runFullTask('middlewareTask', taskParams, (error, response) => {
      expect(error).to.be.null()
      expect(response.result).to.equal('fin')
      done()
    })
  })

  // it('should reject task with improper params', (done) => {
  //   api.tasks.enqueue('middlewareTask', {invalid: true}, 'test', (error, toRun) => {
  //     expect(error).to.be.ok()
  //     expect(error.message).to.equal('Invalid Parameter')
  //     api.tasks.queued('test', 0, 999, (error, tasks) => {
  //       expect(error).to.be.null()
  //       expect(tasks).to.have.length(0)
  //       done()
  //     })
  //   })
  // })
})
