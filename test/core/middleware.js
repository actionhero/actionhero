'use strict'

var chai = require('chai')
var dirtyChai = require('dirty-chai')
var expect = chai.expect
chai.use(dirtyChai)

let path = require('path')
var ActionheroPrototype = require(path.join(__dirname, '/../../actionhero.js'))
var actionhero = new ActionheroPrototype()
var api

describe('Core: Middleware', () => {
  before((done) => {
    actionhero.start((error, a) => {
      expect(error).to.be.null()
      api = a
      done()
    })
  })

  after((done) => {
    actionhero.stop(() => {
      done()
    })
  })

  afterEach((done) => {
    api.actions.middleware = {}
    api.actions.globalMiddleware = []
    done()
  })

  describe('action preProcessors', () => {
    it('I can define a global preProcessor and it can append the connection', (done) => {
      api.actions.addMiddleware({
        name: 'test middleware',
        global: true,
        preProcessor: function (data, next) {
          data.response._preProcessorNote = 'note'
          next()
        }
      })

      api.specHelper.runAction('randomNumber', (response) => {
        expect(response._preProcessorNote).to.equal('note')
        done()
      })
    })

    it('I can define a local preProcessor and it will not append the connection', (done) => {
      api.actions.addMiddleware({
        name: 'test middleware',
        global: false,
        preProcessor: function (data, next) {
          data.response._preProcessorNote = 'note'
          next()
        }
      })

      api.specHelper.runAction('randomNumber', (response) => {
        expect(response._preProcessorNote).to.not.exist()
        done()
      })
    })

    it('preProcessors with priorities run in the right order', (done) => {
      // first priority
      api.actions.addMiddleware({
        name: 'first test middleware',
        global: true,
        priority: 1,
        preProcessor: function (data, next) {
          data.response._processorNoteFirst = 'first'
          data.response._processorNoteEarly = 'first'
          data.response._processorNoteLate = 'first'
          data.response._processorNoteDefault = 'first'
          next()
        }
      })

      // lower number priority (runs sooner)
      api.actions.addMiddleware({
        name: 'early test middleware',
        global: true,
        priority: api.config.general.defaultProcessorPriority - 1,
        preProcessor: function (data, next) {
          data.response._processorNoteEarly = 'early'
          data.response._processorNoteLate = 'early'
          data.response._processorNoteDefault = 'early'
          next()
        }
      })

      // old style "default" priority
      api.actions.addMiddleware({
        name: 'default test middleware',
        global: true,
        preProcessor: function (data, next) {
          data.response._processorNoteLate = 'default'
          data.response._processorNoteDefault = 'default'
          next()
        }
      })

      // higher number priority (runs later)
      api.actions.addMiddleware({
        name: 'late test middleware',
        global: true,
        priority: api.config.general.defaultProcessorPriority + 1,
        preProcessor: function (data, next) {
          data.response._processorNoteLate = 'late'
          next()
        }
      })

      api.specHelper.runAction('randomNumber', (response) => {
        expect(response._processorNoteFirst).to.equal('first')
        expect(response._processorNoteEarly).to.equal('early')
        expect(response._processorNoteDefault).to.equal('default')
        expect(response._processorNoteLate).to.equal('late')
        done()
      })
    })

    it('multiple preProcessors with same priority are executed', (done) => {
      api.actions.addMiddleware({
        name: 'first test middleware',
        global: true,
        priority: api.config.general.defaultProcessorPriority - 1,
        preProcessor: function (data, next) {
          data.response._processorNoteFirst = 'first'
          next()
        }
      })

      api.actions.addMiddleware({
        name: 'late test middleware',
        global: true,
        priority: api.config.general.defaultProcessorPriority - 1,
        preProcessor: function (data, next) {
          data.response._processorNoteSecond = 'second'
          next()
        }
      })

      api.specHelper.runAction('randomNumber', (response) => {
        expect(response._processorNoteFirst).to.equal('first')
        expect(response._processorNoteSecond).to.equal('second')
        done()
      })
    })

    it('postProcessors can append the connection', (done) => {
      api.actions.addMiddleware({
        name: 'test middleware',
        global: true,
        postProcessor: function (data, next) {
          data.response._postProcessorNote = 'note'
          next()
        }
      })

      api.specHelper.runAction('randomNumber', (response) => {
        expect(response._postProcessorNote).to.equal('note')
        done()
      })
    })

    it('postProcessors with priorities run in the right order', (done) => {
      // first priority
      api.actions.addMiddleware({
        name: 'first test middleware',
        global: true,
        priority: 1,
        postProcessor: function (data, next) {
          data.response._processorNoteFirst = 'first'
          data.response._processorNoteEarly = 'first'
          data.response._processorNoteLate = 'first'
          data.response._processorNoteDefault = 'first'
          next()
        }
      })

      // lower number priority (runs sooner)
      api.actions.addMiddleware({
        name: 'early test middleware',
        global: true,
        priority: api.config.general.defaultProcessorPriority - 1,
        postProcessor: function (data, next) {
          data.response._processorNoteEarly = 'early'
          data.response._processorNoteLate = 'early'
          data.response._processorNoteDefault = 'early'
          next()
        }
      })

      // old style "default" priority
      api.actions.addMiddleware({
        name: 'default test middleware',
        global: true,
        postProcessor: function (data, next) {
          data.response._processorNoteLate = 'default'
          data.response._processorNoteDefault = 'default'
          next()
        }
      })

      // higher number priority (runs later)
      api.actions.addMiddleware({
        name: 'late test middleware',
        global: true,
        priority: api.config.general.defaultProcessorPriority + 1,
        postProcessor: function (data, next) {
          data.response._processorNoteLate = 'late'
          next()
        }
      })

      api.specHelper.runAction('randomNumber', (response) => {
        expect(response._processorNoteFirst).to.equal('first')
        expect(response._processorNoteEarly).to.equal('early')
        expect(response._processorNoteDefault).to.equal('default')
        expect(response._processorNoteLate).to.equal('late')
        done()
      })
    })

    it('multiple postProcessors with same priority are executed', (done) => {
      api.actions.addMiddleware({
        name: 'first middleware',
        global: true,
        priority: api.config.general.defaultProcessorPriority - 1,
        postProcessor: function (data, next) {
          data.response._processorNoteFirst = 'first'
          next()
        }
      })

      api.actions.addMiddleware({
        name: 'second middleware',
        global: true,
        priority: api.config.general.defaultProcessorPriority - 1,
        postProcessor: function (data, next) {
          data.response._processorNoteSecond = 'second'
          next()
        }
      })

      api.specHelper.runAction('randomNumber', (response) => {
        expect(response._processorNoteFirst).to.equal('first')
        expect(response._processorNoteSecond).to.equal('second')
        done()
      })
    })

    it('preProcessors can block actions', (done) => {
      api.actions.addMiddleware({
        name: 'test middleware',
        global: true,
        preProcessor: function (data, next) {
          next(new Error('BLOCKED'))
        }
      })

      api.specHelper.runAction('randomNumber', (response) => {
        expect(response.error).to.equal('Error: BLOCKED')
        expect(response.randomNumber).to.not.exist()
        done()
      })
    })

    it('postProcessors can modify toRender', (done) => {
      api.actions.addMiddleware({
        name: 'test middleware',
        global: true,
        postProcessor: function (data, next) {
          data.toRender = false
          next()
        }
      })

      api.specHelper.runAction('randomNumber', () => {
        throw new Error('should not get a response')
      })
      setTimeout(() => {
        done()
      }, 1000)
    })
  })

  describe('connection create/destroy callbacks', () => {
    beforeEach((done) => {
      api.connections.middleware = {}
      api.connections.globalMiddleware = []
      done()
    })

    afterEach((done) => {
      api.connections.middleware = {}
      api.connections.globalMiddleware = []
      done()
    })

    it('can create callbacks on connection creation', (done) => {
      api.connections.addMiddleware({
        name: 'connection middleware',
        create: () => {
          done()
        }
      })
      api.specHelper.runAction('randomNumber', () => {
        //
      })
    })

    it('can create callbacks on connection destroy', (done) => {
      api.connections.addMiddleware({
        name: 'connection middleware',
        destroy: () => {
          done()
        }
      })

      api.specHelper.runAction('randomNumber', (response, connection) => {
        connection.destroy()
      })
    })
  })
})
