'use strict'

const path = require('path')
const ActionHero = require(path.join(__dirname, '/../../index.js'))
const actionhero = new ActionHero.Process()
let api

describe('Core: Middleware', () => {
  beforeAll(async () => { api = await actionhero.start() })
  afterAll(async () => { await actionhero.stop() })

  afterEach(() => {
    api.actions.middleware = {}
    api.actions.globalMiddleware = []
  })

  describe('action preProcessors', () => {
    test(
      'can define a global preProcessor and it can append the connection',
      async () => {
        api.actions.addMiddleware({
          name: 'test middleware',
          global: true,
          preProcessor: (data) => {
            data.response._preProcessorNote = 'note'
          }
        })

        const { _preProcessorNote, error } = await api.specHelper.runAction('randomNumber')
        expect(error).toBeUndefined()
        expect(_preProcessorNote).toEqual('note')
      }
    )

    test(
      'can define an async global preProcessor and it can append the connection',
      async () => {
        api.actions.addMiddleware({
          name: 'test middleware',
          global: true,
          preProcessor: async (data) => {
            await new Promise((resolve) => { setTimeout(resolve, 100) })
            data.response._preProcessorNote = 'slept'
          }
        })

        const { _preProcessorNote, error } = await api.specHelper.runAction('randomNumber')
        expect(error).toBeUndefined()
        expect(_preProcessorNote).toEqual('slept')
      }
    )

    test(
      'can define a local preProcessor and it will not append the connection',
      async () => {
        api.actions.addMiddleware({
          name: 'test middleware',
          global: false,
          preProcessor: (data) => {
            data.response._preProcessorNote = 'note'
          }
        })

        const { _preProcessorNote, error } = await api.specHelper.runAction('randomNumber')
        expect(error).toBeUndefined()
        expect(_preProcessorNote).toBeUndefined()
      }
    )

    describe('midleware can read properties of the action template', () => {
      beforeAll(() => {
        api.actions.versions.authAction = [1]
        api.actions.actions.authAction = {
          1: {
            name: 'authAction',
            description: 'I am a test',
            version: 1,
            authenticated: true,
            run: (data) => {
              data.response.thing = 'stuff'
            }
          }
        }
      })

      afterAll(() => {
        delete api.actions.actions.authAction
        delete api.actions.versions.authAction
      })

      test('can read action template properties', async () => {
        api.actions.addMiddleware({
          name: 'auth middleware',
          global: true,
          preProcessor: (data) => {
            if (data.actionTemplate.authenticated === true) {
              data.response.authenticatedAction = true
            } else {
              data.response.authenticatedAction = false
            }
          }
        })

        const randomResponse = await api.specHelper.runAction('randomNumber')
        expect(randomResponse.authenticatedAction).toEqual(false)

        const authResponse = await api.specHelper.runAction('authAction')
        expect(authResponse.authenticatedAction).toEqual(true)
      })
    })

    test('preProcessors with priorities run in the right order', async () => {
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
        priority: api.config.general.defaultMiddlewarePriority - 1,
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
        priority: api.config.general.defaultMiddlewarePriority + 1,
        preProcessor: (data) => {
          data.response._processorNoteLate = 'late'
        }
      })

      const response = await api.specHelper.runAction('randomNumber')
      expect(response._processorNoteFirst).toEqual('first')
      expect(response._processorNoteEarly).toEqual('early')
      expect(response._processorNoteDefault).toEqual('default')
      expect(response._processorNoteLate).toEqual('late')
    })

    test('multiple preProcessors with same priority are executed', async () => {
      api.actions.addMiddleware({
        name: 'first test middleware',
        global: true,
        priority: api.config.general.defaultMiddlewarePriority - 1,
        preProcessor: (data) => {
          data.response._processorNoteFirst = 'first'
        }
      })

      api.actions.addMiddleware({
        name: 'late test middleware',
        global: true,
        priority: api.config.general.defaultMiddlewarePriority - 1,
        preProcessor: (data) => {
          data.response._processorNoteSecond = 'second'
        }
      })

      const response = await api.specHelper.runAction('randomNumber')
      expect(response._processorNoteFirst).toEqual('first')
      expect(response._processorNoteSecond).toEqual('second')
    })

    test('postProcessors can append the connection', async () => {
      api.actions.addMiddleware({
        name: 'test middleware',
        global: true,
        postProcessor: (data) => {
          data.response._postProcessorNote = 'note'
        }
      })

      const response = await api.specHelper.runAction('randomNumber')
      expect(response._postProcessorNote).toEqual('note')
    })

    test('postProcessors with priorities run in the right order', async () => {
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
        priority: api.config.general.defaultMiddlewarePriority - 1,
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
        priority: api.config.general.defaultMiddlewarePriority + 1,
        postProcessor: (data) => {
          data.response._processorNoteLate = 'late'
        }
      })

      const response = await api.specHelper.runAction('randomNumber')
      expect(response._processorNoteFirst).toEqual('first')
      expect(response._processorNoteEarly).toEqual('early')
      expect(response._processorNoteDefault).toEqual('default')
      expect(response._processorNoteLate).toEqual('late')
    })

    test('multiple postProcessors with same priority are executed', async () => {
      api.actions.addMiddleware({
        name: 'first middleware',
        global: true,
        priority: api.config.general.defaultMiddlewarePriority - 1,
        postProcessor: (data) => {
          data.response._processorNoteFirst = 'first'
        }
      })

      api.actions.addMiddleware({
        name: 'second middleware',
        global: true,
        priority: api.config.general.defaultMiddlewarePriority - 1,
        postProcessor: (data) => {
          data.response._processorNoteSecond = 'second'
        }
      })

      const response = await api.specHelper.runAction('randomNumber')
      expect(response._processorNoteFirst).toEqual('first')
      expect(response._processorNoteSecond).toEqual('second')
    })

    test('preProcessors can block actions', async () => {
      api.actions.addMiddleware({
        name: 'test middleware',
        global: true,
        preProcessor: function (data) {
          throw new Error('BLOCKED')
        }
      })

      const { randomNumber, error } = await api.specHelper.runAction('randomNumber')
      expect(error).toEqual('Error: BLOCKED')
      expect(randomNumber).toBeUndefined()
    })

    test('postProcessors can modify toRender', async () => {
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

  describe('connection sync create/destroy callbacks', () => {
    let connection
    beforeEach(() => {
      api.connections.middleware = {}
      api.connections.globalMiddleware = []
    })

    afterEach(() => {
      api.connections.middleware = {}
      api.connections.globalMiddleware = []
    })

    test('can create callbacks on connection creation', async () => {
      let middlewareRan = false
      api.connections.addMiddleware({
        name: 'connection middleware',
        create: (_connection) => {
          middlewareRan = true
          _connection.touched = 'connect'
        }
      })

      connection = await api.specHelper.Connection.createAsync()

      expect(middlewareRan).toEqual(true)
      expect(connection.touched).toEqual('connect')
    })

    test('can create callbacks on connection destroy', async () => {
      let middlewareRan = false
      api.connections.addMiddleware({
        name: 'connection middleware',
        destroy: (_connection) => {
          middlewareRan = true
          expect(_connection.touched).toEqual('connect')
        }
      })

      connection.destroy()
      expect(middlewareRan).toEqual(true)
    })
  })

  describe('connection async create/destroy callbacks', () => {
    beforeEach(() => {
      api.connections.middleware = {}
      api.connections.globalMiddleware = []
    })

    afterEach(() => {
      api.connections.middleware = {}
      api.connections.globalMiddleware = []
    })

    test('can create async callbacks on connection create/destroy', async () => {
      let middlewareRan = false
      let middlewareDestoryRan = false

      api.connections.addMiddleware({
        name: 'connection middleware',
        create: async (_connection) => {
          middlewareRan = true
          await api.utils.sleep(1)
          _connection.longProcessResult = true
        },
        destroy: async (_connection) => {
          await api.utils.sleep(1)
          middlewareDestoryRan = true
        }
      })

      const connection = await api.specHelper.Connection.createAsync()

      // create
      expect(middlewareRan).toEqual(true)
      expect(connection.longProcessResult).toEqual(true)

      // destroy
      await connection.destroy()
      expect(middlewareDestoryRan).toEqual(true)
    })
  })
})
