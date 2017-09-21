'use strict'

const uuid = require('uuid')
const NodeResque = require('node-resque')
const ActionHero = require('./../index.js')

module.exports = class SpecHelper extends ActionHero.Initializer {
  constructor () {
    super()
    this.name = 'specHelper'
    this.loadPriority = 900
    this.startPriority = 901
    this.enabled = false
  }

  initialize (api) {
    if (api.env === 'test' || process.env.SPECHELPER === 'true' || process.env.SPECHELPER === true) {
      this.enabled = true
    }

    if (!this.enabled) { return }

    class TestServer extends ActionHero.Server {
      constructor () {
        super()
        this.type = 'testServer'
        this.attributes = {
          canChat: true,
          logConnections: false,
          logExits: false,
          sendWelcomeMessage: true,
          verbs: api.connections.allowedVerbs
        }
      }

      start (api) {
        this.api = api
        api.log('loading the testServer', 'warning')
        this.on('connection', (connection) => { this.handleConnection(connection) })
        this.on('actionComplete', (data) => { this.actionComplete(data) })
      }

      stop () {}

      goodbye () {}

      sendMessage (connection, message, messageCount) {
        process.nextTick(() => {
          connection.messages.push(message)
          if (typeof connection.actionCallbacks[messageCount] === 'function') {
            connection.actionCallbacks[messageCount](message, connection)
            delete connection.actionCallbacks[messageCount]
          }
        })
      }

      sendFile (connection, error, fileStream, mime, length) {
        let content = ''
        let response = {
          error: error,
          content: null,
          mime: mime,
          length: length
        }

        try {
          if (!error) {
            fileStream.on('data', (d) => { content += d })
            fileStream.on('end', () => {
              response.content = content
              this.sendMessage(connection, response, connection.messageCount)
            })
          } else {
            this.sendMessage(connection, response, connection.messageCount)
          }
        } catch (e) {
          this.log(e, 'warning')
          this.sendMessage(connection, response, connection.messageCount)
        }
      }

      handleConnection (connection) {
        connection.messages = []
        connection.actionCallbacks = {}
      }

      async actionComplete (data) {
        const api = this.api

        if (typeof data.response === 'string' || Array.isArray(data.response)) {
          if (data.response.error) {
            data.response = await api.config.errors.serializers.servers.specHelper(data.response.error)
          }
        } else {
          if (data.response.error) {
            data.response.error = await api.config.errors.serializers.servers.specHelper(data.response.error)
          }

          if (api.specHelper.returnMetadata) {
            data.response.messageCount = data.messageCount

            data.response.serverInformation = {
              serverName: api.config.general.serverName,
              apiVersion: api.config.general.apiVersion
            }

            data.response.requesterInformation = {
              id: data.connection.id,
              remoteIP: data.connection.remoteIP,
              receivedParams: {}
            }

            for (let k in data.params) {
              data.response.requesterInformation.receivedParams[k] = data.params[k]
            }
          }
        }

        if (data.toRender === true) {
          this.sendMessage(data.connection, data.response, data.messageCount)
        }
      }
    }

    api.specHelper = {
      returnMetadata: true,
      Server: TestServer
    }

    api.specHelper.Connection = class {
      constructor () {
        let id = uuid.v4()
        api.servers.servers.testServer.buildConnection(api, {
          id: id,
          rawConnection: {},
          remoteAddress: 'testServer',
          remotePort: 0
        })

        return api.connections.connections[id]
      }
    }

    // create helpers to run an action
    // data can be a params hash or a connection
    api.specHelper.runAction = async (actionName, input) => {
      let connection
      if (!input) { input = {} }
      if (input.id && input.type === 'testServer') {
        connection = input
      } else {
        connection = new api.specHelper.Connection()
        connection.params = input
      }

      connection.params.action = actionName

      connection.messageCount++
      let response = await new Promise((resolve) => {
        api.servers.servers.testServer.processAction(api, connection)
        connection.actionCallbacks[(connection.messageCount)] = resolve
      })

      return response
    }

    // helpers to get files
    api.specHelper.getStaticFile = async (file) => {
      let connection = new api.specHelper.Connection()
      connection.params.file = file

      connection.messageCount++
      let response = await new Promise((resolve) => {
        api.servers.servers.testServer.processFile(connection)
        connection.actionCallbacks[(connection.messageCount)] = resolve
      })

      return response
    }

    // create helpers to run a task
    api.specHelper.runTask = async (taskName, params, next) => {
      return api.tasks.tasks[taskName].run(api, params)
    }

    api.specHelper.runFullTask = async (taskName, params) => {
      const worker = new NodeResque.Worker({
        connection: api.redis.clients.tasks,
        queues: api.config.tasks.queues || ['default']
      }, api.tasks.jobs)

      await worker.connect()
      let result = await worker.performInline(taskName, params)
      await worker.end()
      return result
    }
  }

  async start (api) {
    if (!this.enabled) { return }

    let server = new api.specHelper.Server()
    server.config = { enabled: true }
    await server.start(api)
    api.servers.servers.testServer = server
  }
}
