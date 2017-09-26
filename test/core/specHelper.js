'use strict'

const chai = require('chai')
const dirtyChai = require('dirty-chai')
const expect = chai.expect
chai.use(dirtyChai)

const path = require('path')
const ActionHero = require(path.join(__dirname, '/../../index.js'))
const actionhero = new ActionHero.Process()
let api

describe('Core: specHelper', () => {
  before(async () => { api = await actionhero.start() })
  after(async () => { await actionhero.stop() })

  it('can make a requset with just params', async () => {
    let {randomNumber} = await api.specHelper.runAction('randomNumber')
    expect(randomNumber).to.be.at.least(0)
    expect(randomNumber).to.be.at.most(1)
  })

  it('will stack up messages recieved', async () => {
    let connection = new api.specHelper.Connection()
    connection.params.thing = 'stuff'
    let {error} = await api.specHelper.runAction('x', connection)
    expect(connection.messages).to.have.length(2)
    expect(connection.messages[0].welcome).to.equal('Hello! Welcome to the actionhero api')
    expect(connection.messages[1].error).to.equal('Error: unknown action or invalid apiVersion')
    expect(error).to.equal('Error: unknown action or invalid apiVersion')
  })

  describe('metadata, type-saftey, and errors', () => {
    before(() => {
      api.actions.versions.stringResponseTestAction = [1]
      api.actions.actions.stringResponseTestAction = {
        '1': {
          name: 'stringResponseTestAction',
          description: 'stringResponseTestAction',
          version: 1,
          run: (data) => {
            data.response = 'something response'
          }
        }
      }

      api.actions.versions.stringErrorTestAction = [1]
      api.actions.actions.stringErrorTestAction = {
        '1': {
          name: 'stringErrorTestAction',
          description: 'stringErrorTestAction',
          version: 1,
          run: (data) => {
            data.response = 'something response'
            throw new Error('some error')
          }
        }
      }

      api.actions.versions.arrayResponseTestAction = [1]
      api.actions.actions.arrayResponseTestAction = {
        '1': {
          name: 'arrayResponseTestAction',
          description: 'arrayResponseTestAction',
          version: 1,
          run: (data) => {
            data.response = [1, 2, 3]
          }
        }
      }

      api.actions.versions.arrayErrorTestAction = [1]
      api.actions.actions.arrayErrorTestAction = {
        '1': {
          name: 'arrayErrorTestAction',
          description: 'arrayErrorTestAction',
          version: 1,
          run: (data) => {
            data.response = [1, 2, 3]
            throw new Error('some error')
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
      it('if the response payload is an object, it appends metadata', async () => {
        let response = await api.specHelper.runAction('randomNumber')
        expect(response.error).to.not.exist()
        expect(response.randomNumber).to.exist()
        expect(response.messageCount).to.equal(1)
        expect(response.serverInformation.serverName).to.equal('actionhero')
        expect(response.requesterInformation.remoteIP).to.equal('testServer')
      })

      it('if the response payload is a string, it maintains type', async () => {
        let response = await api.specHelper.runAction('stringResponseTestAction')
        expect(response).to.equal('something response')
        expect(response.error).to.not.exist()
        expect(response.messageCount).to.not.exist()
        expect(response.serverInformation).to.not.exist()
        expect(response.requesterInformation).to.not.exist()
      })

      it('if the response payload is a array, it maintains type', async () => {
        let response = await api.specHelper.runAction('arrayResponseTestAction')
        expect(response).to.deep.equal([1, 2, 3])
        expect(response.error).to.not.exist()
        expect(response.messageCount).to.not.exist()
        expect(response.serverInformation).to.not.exist()
        expect(response.requesterInformation).to.not.exist()
      })
    })

    describe('disabling metadata', () => {
      before(() => { api.specHelper.returnMetadata = false })
      after(() => { api.specHelper.returnMetadata = true })

      it('if the response payload is an object, it should not append metadata', async () => {
        let response = await api.specHelper.runAction('randomNumber')
        expect(response.error).to.not.exist()
        expect(response.randomNumber).to.exist()
        expect(response.messageCount).to.not.exist()
        expect(response.serverInformation).to.not.exist()
        expect(response.requesterInformation).to.not.exist()
      })
    })

    describe('errors', () => {
      it('if the response payload is an object and there is an error, it appends metadata', async () => {
        let response = await api.specHelper.runAction('x')
        expect(response.error).to.equal('Error: unknown action or invalid apiVersion')
        expect(response.messageCount).to.equal(1)
        expect(response.serverInformation.serverName).to.equal('actionhero')
        expect(response.requesterInformation.remoteIP).to.equal('testServer')
      })

      it('if the response payload is a string, just the error will be returned', async () => {
        let response = await api.specHelper.runAction('stringErrorTestAction')
        expect(response).to.equal('Error: some error')
        expect(response.messageCount).to.not.exist()
        expect(response.serverInformation).to.not.exist()
        expect(response.requesterInformation).to.not.exist()
      })

      it('if the response payload is a array, just the error will be returned', async () => {
        let response = await api.specHelper.runAction('arrayErrorTestAction')
        expect(response).to.equal('Error: some error')
        expect(response.messageCount).to.not.exist()
        expect(response.serverInformation).to.not.exist()
        expect(response.requesterInformation).to.not.exist()
      })
    })
  })

  describe('test responses', () => {
    it('will not report a broken test as a broken action (sync)', async () => {
      let response = await api.specHelper.runAction('randomNumber')
      try {
        response.not.a.real.thing()
        throw new Error('should not get here')
      } catch (e) {
        expect(String(e)).to.equal('TypeError: Cannot read property \'a\' of undefined')
      }
    })

    it('will not report a broken test as a broken action (async)', async () => {
      let response = await api.specHelper.runAction('sleepTest')
      try {
        response.not.a.real.thing()
        throw new Error('should not get here')
      } catch (e) {
        expect(String(e)).to.equal('TypeError: Cannot read property \'a\' of undefined')
      }
    })
  })

  describe('files', () => {
    it('can request file data', async () => {
      let data = await api.specHelper.getStaticFile('simple.html')
      expect(data.error).to.not.exist()
      expect(data.content).to.equal('<h1>ActionHero</h1>\\nI am a flat file being served to you via the API from ./public/simple.html<br />')
      expect(data.mime).to.equal('text/html')
      expect(data.length).to.equal(101)
    })

    it('missing files', async () => {
      let data = await api.specHelper.getStaticFile('missing.html')
      expect(data.error).to.equal('That file is not found')
      expect(data.mime).to.equal('text/html')
      expect(data.content).to.be.null()
    })
  })

  describe('persistent test connections', () => {
    let connection
    let connId

    it('can make a requset with a spec\'d connection', async () => {
      connection = new api.specHelper.Connection()
      connection.params = {
        key: 'someKey',
        value: 'someValue'
      }

      connId = connection.id

      let response = await api.specHelper.runAction('cacheTest', connection)
      expect(response.messageCount).to.equal(1)
      expect(connection.messages).to.have.length(2)
      expect(connId).to.equal(connection.id)
      expect(connection.fingerprint).to.equal(connId)
    })

    it('can make second request', async () => {
      let response = await api.specHelper.runAction('randomNumber', connection)
      expect(response.messageCount).to.equal(2)
      expect(connection.messages).to.have.length(3)
      expect(connId).to.equal(connection.id)
      expect(connection.fingerprint).to.equal(connId)
    })

    it('will generate new ids and fingerprints for a new connection', async () => {
      let response = await api.specHelper.runAction('randomNumber')
      expect(response.messageCount).to.equal(1)
      expect(response.requesterInformation.id).not.to.equal(connId)
      expect(response.requesterInformation.fingerprint).not.to.equal(connId)
    })
  })

  describe('tasks', () => {
    let taskRan = false
    before(() => {
      api.tasks.tasks.testTask = {
        name: 'testTask',
        description: 'task: ' + this.name,
        queue: 'default',
        frequency: 0,
        plugins: [],
        pluginOptions: {},
        run: (api, params) => {
          taskRan = true
          return 'OK'
        }
      }

      api.tasks.jobs.testTask = api.tasks.jobWrapper('testTask')
    })

    after(() => {
      delete api.testOutput
      delete api.tasks.tasks.testTask
    })

    it('can run tasks', async () => {
      let response = await api.specHelper.runTask('testTask')
      expect(response).to.equal('OK')
      expect(taskRan).to.equal(true)
    })
  })
})
