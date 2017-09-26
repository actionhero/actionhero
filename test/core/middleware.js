'use strict'

const chai = require('chai')
const dirtyChai = require('dirty-chai')
const expect = chai.expect
chai.use(dirtyChai)

const path = require('path')
const ActionHero = require(path.join(__dirname, '/../../index.js'))
const actionhero = new ActionHero.Process()
let api

describe('Core: Middleware', () => {
  before(async () => { api = await actionhero.start() })
  after(async () => { await actionhero.stop() })

  afterEach(() => {
    api.actions.middleware = {}
    api.actions.globalMiddleware = []
  })

  describe('action preProcessors', () => {
    it('I can define a global preProcessor and it can append the connection', async () => {
      api.actions.addMiddleware({
        name: 'test middleware',
        global: true,
        preProcessor: (data) => {
          data.response._preProcessorNote = 'note'
        }
      })

      let {_preProcessorNote, error} = await api.specHelper.runAction('randomNumber')
      expect(error).to.not.exist()
      expect(_preProcessorNote).to.equal('note')
    })

    it('I can define an async global preProcessor and it can append the connection', async () => {
      api.actions.addMiddleware({
        name: 'test middleware',
        global: true,
        preProcessor: async (data) => {
          await new Promise((resolve) => { setTimeout(resolve, 100) })
          data.response._preProcessorNote = 'slept'
        }
      })

      let {_preProcessorNote, error} = await api.specHelper.runAction('randomNumber')
      expect(error).to.not.exist()
      expect(_preProcessorNote).to.equal('slept')
    })

    it('I can define a local preProcessor and it will not append the connection', async () => {
      api.actions.addMiddleware({
        name: 'test middleware',
        global: false,
        preProcessor: (data) => {
          data.response._preProcessorNote = 'note'
        }
      })

      let {_preProcessorNote, error} = await api.specHelper.runAction('randomNumber')
      expect(error).to.not.exist()
      expect(_preProcessorNote).to.not.exist()
    })

    it('preProcessors with priorities run in the right order', async () => {
      // first priority
      api.actions.addMiddleware({
        name: 'first test middleware',
        global: true,
        priority: 1,
        preProcessor: (data) => {
          data.response._processorNoteFirst = 'first'
          data.response._processorNoteEarly = 'first'
          data.response._processorNoteLate = 'first'
          data.response._processorNoteDefault = 'first'
        }
      })

      // lower number priority (runs sooner)
      api.actions.addMiddleware({
        name: 'early test middleware',
        global: true,
        priority: api.config.general.defaultProcessorPriority - 1,
        preProcessor: (data) => {
          data.response._processorNoteEarly = 'early'
          data.response._processorNoteLate = 'early'
          data.response._processorNoteDefault = 'early'
        }
      })

      // old style "default" priority
      api.actions.addMiddleware({
        name: 'default test middleware',
        global: true,
        preProcessor: (data) => {
          data.response._processorNoteLate = 'default'
          data.response._processorNoteDefault = 'default'
        }
      })

      // higher number priority (runs later)
      api.actions.addMiddleware({
        name: 'late test middleware',
        global: true,
        priority: api.config.general.defaultProcessorPriority + 1,
        preProcessor: (data) => {
          data.response._processorNoteLate = 'late'
        }
      })

      let response = await api.specHelper.runAction('randomNumber')
      expect(response._processorNoteFirst).to.equal('first')
      expect(response._processorNoteEarly).to.equal('early')
      expect(response._processorNoteDefault).to.equal('default')
      expect(response._processorNoteLate).to.equal('late')
    })

    it('multiple preProcessors with same priority are executed', async () => {
      api.actions.addMiddleware({
        name: 'first test middleware',
        global: true,
        priority: api.config.general.defaultProcessorPriority - 1,
        preProcessor: (data) => {
          data.response._processorNoteFirst = 'first'
        }
      })

      api.actions.addMiddleware({
        name: 'late test middleware',
        global: true,
        priority: api.config.general.defaultProcessorPriority - 1,
        preProcessor: (data) => {
          data.response._processorNoteSecond = 'second'
        }
      })

      let response = await api.specHelper.runAction('randomNumber')
      expect(response._processorNoteFirst).to.equal('first')
      expect(response._processorNoteSecond).to.equal('second')
    })

    it('postProcessors can append the connection', async () => {
      api.actions.addMiddleware({
        name: 'test middleware',
        global: true,
        postProcessor: (data) => {
          data.response._postProcessorNote = 'note'
        }
      })

      let response = await api.specHelper.runAction('randomNumber')
      expect(response._postProcessorNote).to.equal('note')
    })

    it('postProcessors with priorities run in the right order', async () => {
      // first priority
      api.actions.addMiddleware({
        name: 'first test middleware',
        global: true,
        priority: 1,
        postProcessor: (data) => {
          data.response._processorNoteFirst = 'first'
          data.response._processorNoteEarly = 'first'
          data.response._processorNoteLate = 'first'
          data.response._processorNoteDefault = 'first'
        }
      })

      // lower number priority (runs sooner)
      api.actions.addMiddleware({
        name: 'early test middleware',
        global: true,
        priority: api.config.general.defaultProcessorPriority - 1,
        postProcessor: (data) => {
          data.response._processorNoteEarly = 'early'
          data.response._processorNoteLate = 'early'
          data.response._processorNoteDefault = 'early'
        }
      })

      // old style "default" priority
      api.actions.addMiddleware({
        name: 'default test middleware',
        global: true,
        postProcessor: (data) => {
          data.response._processorNoteLate = 'default'
          data.response._processorNoteDefault = 'default'
        }
      })

      // higher number priority (runs later)
      api.actions.addMiddleware({
        name: 'late test middleware',
        global: true,
        priority: api.config.general.defaultProcessorPriority + 1,
        postProcessor: (data) => {
          data.response._processorNoteLate = 'late'
        }
      })

      let response = await api.specHelper.runAction('randomNumber')
      expect(response._processorNoteFirst).to.equal('first')
      expect(response._processorNoteEarly).to.equal('early')
      expect(response._processorNoteDefault).to.equal('default')
      expect(response._processorNoteLate).to.equal('late')
    })

    it('multiple postProcessors with same priority are executed', async () => {
      api.actions.addMiddleware({
        name: 'first middleware',
        global: true,
        priority: api.config.general.defaultProcessorPriority - 1,
        postProcessor: (data) => {
          data.response._processorNoteFirst = 'first'
        }
      })

      api.actions.addMiddleware({
        name: 'second middleware',
        global: true,
        priority: api.config.general.defaultProcessorPriority - 1,
        postProcessor: (data) => {
          data.response._processorNoteSecond = 'second'
        }
      })

      let response = await api.specHelper.runAction('randomNumber')
      expect(response._processorNoteFirst).to.equal('first')
      expect(response._processorNoteSecond).to.equal('second')
    })

    it('preProcessors can block actions', async () => {
      api.actions.addMiddleware({
        name: 'test middleware',
        global: true,
        preProcessor: function (data) {
          throw new Error('BLOCKED')
        }
      })

      let {randomNumber, error} = await api.specHelper.runAction('randomNumber')
      expect(error).to.equal('Error: BLOCKED')
      expect(randomNumber).to.not.exist()
    })

    it('postProcessors can modify toRender', async () => {
      api.actions.addMiddleware({
        name: 'test middleware',
        global: true,
        postProcessor: (data) => {
          data.toRender = false
        }
      })

      await new Promise((resolve, reject) => {
        setTimeout(() => { resolve() }, 1000)
        api.specHelper.runAction('randomNumber').then(() => {
          throw new Error('shold.not.get.here')
        })
      })
    })
  })

  describe('connection create/destroy callbacks', () => {
    let connection
    beforeEach(() => {
      api.connections.middleware = {}
      api.connections.globalMiddleware = []
    })

    afterEach(() => {
      api.connections.middleware = {}
      api.connections.globalMiddleware = []
    })

    it('can create callbacks on connection creation', async () => {
      let middlewareRan = false
      api.connections.addMiddleware({
        name: 'connection middleware',
        create: (_connection) => {
          middlewareRan = true
          _connection.touched = 'connect'
        }
      })

      connection = new api.specHelper.Connection()

      expect(middlewareRan).to.equal(true)
      expect(connection.touched).to.equal('connect')
    })

    it('can create callbacks on connection destroy', async () => {
      let middlewareRan = false
      api.connections.addMiddleware({
        name: 'connection middleware',
        destroy: (_connection) => {
          middlewareRan = true
          expect(_connection.touched).to.equal('connect')
        }
      })

      connection.destroy()
      expect(middlewareRan).to.equal(true)
    })
  })
})
