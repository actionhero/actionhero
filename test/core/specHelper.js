'use strict'

var chai = require('chai')
var dirtyChai = require('dirty-chai')
var expect = chai.expect
chai.use(dirtyChai)

let path = require('path')
var ActionheroPrototype = require(path.join(__dirname, '/../../actionhero.js'))
var actionhero = new ActionheroPrototype()
var api

describe('Core: specHelper', () => {
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

  it('can make a requset with just params', (done) => {
    api.specHelper.runAction('randomNumber', (response) => {
      expect(response.randomNumber).to.be.at.least(0)
      expect(response.randomNumber).to.be.at.most(1)
      done()
    })
  })

  it('will stack up messages recieved', (done) => {
    api.specHelper.runAction('x', {thing: 'stuff'}, (response, connection) => {
      expect(connection.messages).to.have.length(2)
      expect(connection.messages[0].welcome).to.equal('Hello! Welcome to the actionhero api')
      expect(connection.messages[1].error).to.equal('Error: unknown action or invalid apiVersion')
      done()
    })
  })

  describe('metadata, type-saftey, and errors', () => {
    before(() => {
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

    after(() => {
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
          expect(response.error).to.not.exist()
          expect(response.randomNumber).to.exist()
          expect(response.messageCount).to.equal(1)
          expect(response.serverInformation.serverName).to.equal('actionhero')
          expect(response.requesterInformation.remoteIP).to.equal('testServer')
          done()
        })
      })

      it('if the response payload is a string, it maintains type', (done) => {
        api.specHelper.runAction('stringResponseTestAction', (response) => {
          expect(response).to.equal('something response')
          expect(response.error).to.not.exist()
          expect(response.messageCount).to.not.exist()
          expect(response.serverInformation).to.not.exist()
          expect(response.requesterInformation).to.not.exist()
          done()
        })
      })

      it('if the response payload is a array, it maintains type', (done) => {
        api.specHelper.runAction('arrayResponseTestAction', (response) => {
          expect(response).to.deep.equal([1, 2, 3])
          expect(response.error).to.not.exist()
          expect(response.messageCount).to.not.exist()
          expect(response.serverInformation).to.not.exist()
          expect(response.requesterInformation).to.not.exist()
          done()
        })
      })
    })

    describe('disabling metadata', () => {
      before(() => { api.specHelper.returnMetadata = false })
      after(() => { api.specHelper.returnMetadata = true })

      it('if the response payload is an object, it should not append metadata', (done) => {
        api.specHelper.runAction('randomNumber', (response) => {
          expect(response.error).to.not.exist()
          expect(response.randomNumber).to.exist()
          expect(response.messageCount).to.not.exist()
          expect(response.serverInformation).to.not.exist()
          expect(response.requesterInformation).to.not.exist()
          done()
        })
      })
    })

    describe('errors', () => {
      it('if the response payload is an object and there is an error, it appends metadata', (done) => {
        api.specHelper.runAction('x', (response) => {
          expect(response.error).to.equal('Error: unknown action or invalid apiVersion')
          expect(response.messageCount).to.equal(1)
          expect(response.serverInformation.serverName).to.equal('actionhero')
          expect(response.requesterInformation.remoteIP).to.equal('testServer')
          done()
        })
      })

      it('if the response payload is a string, just the error will be returned', (done) => {
        api.specHelper.runAction('stringErrorTestAction', (response) => {
          expect(response).to.equal('Error: some error')
          expect(response.messageCount).to.not.exist()
          expect(response.serverInformation).to.not.exist()
          expect(response.requesterInformation).to.not.exist()
          done()
        })
      })

      it('if the response payload is a array, just the error will be returned', (done) => {
        api.specHelper.runAction('arrayErrorTestAction', (response) => {
          expect(response).to.equal('Error: some error')
          expect(response.messageCount).to.not.exist()
          expect(response.serverInformation).to.not.exist()
          expect(response.requesterInformation).to.not.exist()
          done()
        })
      })
    })
  })

  describe('test callbacks', () => {
    it('will not report a broken test as a broken action (sync)', (done) => {
      api.specHelper.runAction('randomNumber', (response) => {
        try {
          response.not.a.real.thing()
        } catch (e) {
          expect(String(e)).to.equal('TypeError: Cannot read property \'a\' of undefined')
          done()
        }
      })
    })

    it('will not report a broken test as a broken action (async)', (done) => {
      api.specHelper.runAction('sleepTest', (response) => {
        try {
          response.not.a.real.thing()
        } catch (e) {
          expect(String(e)).to.equal('TypeError: Cannot read property \'a\' of undefined')
          done()
        }
      })
    })
  })

  describe('files', () => {
    it('can request file data', (done) => {
      api.specHelper.getStaticFile('simple.html', (data) => {
        expect(data.error).to.be.null()
        expect(data.content).to.equal('<h1>ActionHero</h1>\\nI am a flat file being served to you via the API from ./public/simple.html<br />')
        expect(data.mime).to.equal('text/html')
        expect(data.length).to.equal(101)
        done()
      })
    })

    it('missing files', (done) => {
      api.specHelper.getStaticFile('missing.html', (data) => {
        expect(data.error).to.equal('That file is not found')
        expect(data.mime).to.equal('text/html')
        expect(data.content).to.be.null()
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
        expect(response.messageCount).to.equal(1)
        expect(connection.messages).to.have.length(2)
        expect(connId).to.equal(connection.id)
        expect(conn.fingerprint).to.equal(connId)
        done()
      })
    })

    it('can make second request', (done) => {
      api.specHelper.runAction('randomNumber', conn, (response, connection) => {
        expect(response.messageCount).to.equal(2)
        expect(connection.messages).to.have.length(3)
        expect(connId).to.equal(connection.id)
        expect(conn.fingerprint).to.equal(connId)
        done()
      })
    })

    it('will generate new ids and fingerprints for a new connection', (done) => {
      api.specHelper.runAction('randomNumber', {}, (response, connection) => {
        expect(response.messageCount).to.equal(1)
        expect(connection.id).not.to.equal(connId)
        expect(connection.fingerprint).not.to.equal(connId)
        done()
      })
    })
  })

  describe('tasks', () => {
    before((done) => {
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

    after((done) => {
      delete api.testOutput
      delete api.tasks.tasks.testTask
      done()
    })

    it('can run tasks', (done) => {
      api.specHelper.runTask('testTask', {}, (response) => {
        expect(response).to.equal('OK')
        expect(api.testOutput).to.equal('OK')
        done()
      })
    })
  })
})
