'use strict'

let path = require('path')
var ActionheroPrototype = require(path.join(__dirname, '/../../actionhero.js'))
var actionhero = new ActionheroPrototype()
var api

describe('Core: specHelper', () => {
  beforeAll((done) => {
    actionhero.start((error, a) => {
      expect(error).toBeNull()
      api = a
      done()
    })
  })

  afterAll((done) => {
    actionhero.stop(() => {
      done()
    })
  })

  it('can make a requset with just params', (done) => {
    api.specHelper.runAction('randomNumber', (response) => {
      expect(response.randomNumber).toBeGreaterThanOrEqual(0)
      expect(response.randomNumber).toBeLessThanOrEqual(1)
      done()
    })
  })

  it('will stack up messages recieved', (done) => {
    api.specHelper.runAction('x', {thing: 'stuff'}, (response, connection) => {
      expect(connection.messages).toHaveLength(2)
      expect(connection.messages[0].welcome).toBe('Hello! Welcome to the actionhero api')
      expect(connection.messages[1].error).toBe('Error: unknown action or invalid apiVersion')
      done()
    })
  })

  describe('metadata, type-saftey, and errors', () => {
    beforeAll(() => {
      api.actions.versions.stringResponseTestAction = [1]
      api.actions.actions.stringResponseTestAction = {
        '1': {
          name: 'stringResponseTestAction',
          description: 'stringResponseTestAction',
          version: 1,
          run: (api, data, next) => {
            data.response = 'something response'
            next()
          }
        }
      }

      api.actions.versions.stringErrorTestAction = [1]
      api.actions.actions.stringErrorTestAction = {
        '1': {
          name: 'stringErrorTestAction',
          description: 'stringErrorTestAction',
          version: 1,
          run: (api, data, next) => {
            data.response = 'something response'
            next('some error')
          }
        }
      }

      api.actions.versions.arrayResponseTestAction = [1]
      api.actions.actions.arrayResponseTestAction = {
        '1': {
          name: 'arrayResponseTestAction',
          description: 'arrayResponseTestAction',
          version: 1,
          run: (api, data, next) => {
            data.response = [1, 2, 3]
            next()
          }
        }
      }

      api.actions.versions.arrayErrorTestAction = [1]
      api.actions.actions.arrayErrorTestAction = {
        '1': {
          name: 'arrayErrorTestAction',
          description: 'arrayErrorTestAction',
          version: 1,
          run: (api, data, next) => {
            data.response = [1, 2, 3]
            next('some error')
          }
        }
      }
    })

    afterAll(() => {
      delete api.actions.actions.stringResponseTestAction
      delete api.actions.versions.stringResponseTestAction
      delete api.actions.actions.stringErrorTestAction
      delete api.actions.versions.stringErrorTestAction
      delete api.actions.actions.arrayResponseTestAction
      delete api.actions.versions.arrayResponseTestAction
      delete api.actions.actions.arrayErrorTestAction
      delete api.actions.versions.arrayErrorTestAction
    })

    describe('happy-path', () => {
      it('if the response payload is an object, it appends metadata', (done) => {
        api.specHelper.runAction('randomNumber', (response) => {
          expect(response.error).toBeUndefined()
          expect(response.randomNumber).toBeDefined()
          expect(response.messageCount).toBe(1)
          expect(response.serverInformation.serverName).toBe('actionhero')
          expect(response.requesterInformation.remoteIP).toBe('testServer')
          done()
        })
      })

      it('if the response payload is a string, it maintains type', (done) => {
        api.specHelper.runAction('stringResponseTestAction', (response) => {
          expect(response).toBe('something response')
          expect(response.error).toBeUndefined()
          expect(response.messageCount).toBeUndefined()
          expect(response.serverInformation).toBeUndefined()
          expect(response.requesterInformation).toBeUndefined()
          done()
        })
      })

      it('if the response payload is a array, it maintains type', (done) => {
        api.specHelper.runAction('arrayResponseTestAction', (response) => {
          expect(response).toEqual([1, 2, 3])
          expect(response.error).toBeUndefined()
          expect(response.messageCount).toBeUndefined()
          expect(response.serverInformation).toBeUndefined()
          expect(response.requesterInformation).toBeUndefined()
          done()
        })
      })
    })

    describe('disabling metadata', () => {
      beforeAll(() => { api.specHelper.returnMetadata = false })
      afterAll(() => { api.specHelper.returnMetadata = true })

      it('if the response payload is an object, it should not append metadata', (done) => {
        api.specHelper.runAction('randomNumber', (response) => {
          expect(response.error).toBeUndefined()
          expect(response.randomNumber).toBeDefined()
          expect(response.messageCount).toBeUndefined()
          expect(response.serverInformation).toBeUndefined()
          expect(response.requesterInformation).toBeUndefined()
          done()
        })
      })
    })

    describe('errors', () => {
      it('if the response payload is an object and there is an error, it appends metadata', (done) => {
        api.specHelper.runAction('x', (response) => {
          expect(response.error).toBe('Error: unknown action or invalid apiVersion')
          expect(response.messageCount).toBe(1)
          expect(response.serverInformation.serverName).toBe('actionhero')
          expect(response.requesterInformation.remoteIP).toBe('testServer')
          done()
        })
      })

      it('if the response payload is a string, just the error will be returned', (done) => {
        api.specHelper.runAction('stringErrorTestAction', (response) => {
          expect(response).toBe('Error: some error')
          expect(response.messageCount).toBeUndefined()
          expect(response.serverInformation).toBeUndefined()
          expect(response.requesterInformation).toBeUndefined()
          done()
        })
      })

      it('if the response payload is a array, just the error will be returned', (done) => {
        api.specHelper.runAction('arrayErrorTestAction', (response) => {
          expect(response).toBe('Error: some error')
          expect(response.messageCount).toBeUndefined()
          expect(response.serverInformation).toBeUndefined()
          expect(response.requesterInformation).toBeUndefined()
          done()
        })
      })
    })
  })

  describe('test callbacks', () => {
    it('will not report a broken test as a broken action (sync)', (done) => {
      api.specHelper.runAction('randomNumber', (response) => {
        try {
          response.not.a.real.thing
        } catch (e) {
          expect(String(e)).toBe('TypeError: Cannot read property \'a\' of undefined')
          done()
        }
      })
    })

    it('will not report a broken test as a broken action (async)', (done) => {
      api.specHelper.runAction('sleepTest', (response) => {
        try {
          response.not.a.real.thing
        } catch (e) {
          expect(String(e)).toBe('TypeError: Cannot read property \'a\' of undefined')
          done()
        }
      })
    })
  })

  describe('files', () => {
    it('can request file data', (done) => {
      api.specHelper.getStaticFile('simple.html', (data) => {
        expect(data.error).toBeNull()
        expect(data.content).toBe('<h1>ActionHero</h1>\\nI am a flat file being served to you via the API from ./public/simple.html<br />')
        expect(data.mime).toBe('text/html')
        expect(data.length).toBe(101)
        done()
      })
    })

    it('missing files', (done) => {
      api.specHelper.getStaticFile('missing.html', (data) => {
        expect(data.error).toBe('That file is not found')
        expect(data.mime).toBe('text/html')
        expect(data.content).toBeNull()
        done()
      })
    })
  })

  describe('persistent test connections', () => {
    var conn
    var connId

    it('can make a requset with a spec\'d connection', (done) => {
      conn = new api.specHelper.Connection()
      conn.params = {
        key: 'someKey',
        value: 'someValue'
      }
      connId = conn.id
      api.specHelper.runAction('cacheTest', conn, (response, connection) => {
        expect(response.messageCount).toBe(1)
        expect(connection.messages).toHaveLength(2)
        expect(connId).toBe(connection.id)
        expect(conn.fingerprint).toBe(connId)
        done()
      })
    })

    it('can make second request', (done) => {
      api.specHelper.runAction('randomNumber', conn, (response, connection) => {
        expect(response.messageCount).toBe(2)
        expect(connection.messages).toHaveLength(3)
        expect(connId).toBe(connection.id)
        expect(conn.fingerprint).toBe(connId)
        done()
      })
    })

    it('will generate new ids and fingerprints for a new connection', (done) => {
      api.specHelper.runAction('randomNumber', {}, (response, connection) => {
        expect(response.messageCount).toBe(1)
        expect(connection.id).not.toBe(connId)
        expect(connection.fingerprint).not.toBe(connId)
        done()
      })
    })
  })

  describe('tasks', () => {
    beforeAll((done) => {
      api.tasks.tasks.testTask = {
        name: 'testTask',
        description: 'task: ' + this.name,
        queue: 'default',
        frequency: 0,
        plugins: [],
        pluginOptions: {},
        run: (api, params, next) => {
          api.testOutput = 'OK' // test modifying the api pbject
          next('OK')
        }
      }

      api.tasks.jobs.testTask = api.tasks.jobWrapper('testTask')
      done()
    })

    afterAll((done) => {
      delete api.testOutput
      delete api.tasks.tasks.testTask
      done()
    })

    it('can run tasks', (done) => {
      api.specHelper.runTask('testTask', {}, (response) => {
        expect(response).toBe('OK')
        expect(api.testOutput).toBe('OK')
        done()
      })
    })
  })
})
