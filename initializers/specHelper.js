'use strict'

const uuid = require('uuid')
const NodeResque = require('node-resque')

module.exports = {
  startPriority: 901,
  loadPriority: 900,
  initialize: function (api) {
    if (api.env === 'test' || process.env.SPECHELPER === 'true' || process.env.SPECHELPER === true) {
      api.specHelper = {
        returnMetadata: true
      }

      // create a test 'server' to run actions
      api.specHelper.initialize = async (api, options) => {
        const type = 'testServer'
        const attributes = {
          canChat: true,
          logConnections: false,
          logExits: false,
          sendWelcomeMessage: true,
          verbs: api.connections.allowedVerbs
        }

        const server = new api.GenericServer(type, options, attributes)

        server.start = () => {
          api.log('loading the testServer', 'warning')
        }

        server.stop = () => {
          // nothing to do
        }

        server.sendMessage = (connection, message, messageCount) => {
          process.nextTick(() => {
            connection.messages.push(message)
            if (typeof connection.actionCallbacks[messageCount] === 'function') {
              connection.actionCallbacks[messageCount](message, connection)
              delete connection.actionCallbacks[messageCount]
            }
          })
        }

        server.sendFile = (connection, error, fileStream, mime, length) => {
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
                server.sendMessage(connection, response, connection.messageCount)
              })
            } else {
              server.sendMessage(connection, response, connection.messageCount)
            }
          } catch (e) {
            api.log(e, 'warning')
            server.sendMessage(connection, response, connection.messageCount)
          }
        }

        server.goodbye = () => {
          //
        }

        server.on('connection', (connection) => {
          connection.messages = []
          connection.actionCallbacks = {}
        })

        server.on('actionComplete', async (data) => {
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
            server.sendMessage(data.connection, data.response, data.messageCount)
          }
        })

        return server
      }

      api.specHelper.Connection = class {
        constructor () {
          let id = uuid.v4()
          api.servers.servers.testServer.buildConnection({
            id: id,
            rawConnection: {},
            remoteAddress: 'testServer',
            remotePort: 0
          })

          return api.connections.connections[id]
        }
      }
      api.specHelper.connection = api.specHelper.Connection

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
          api.servers.servers.testServer.processAction(connection)
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
  },

  start: async function (api) {
    if (api.env === 'test' || process.env.SPECHELPER === 'true' || process.env.SPECHELPER === true) {
      let serverObject = await api.specHelper.initialize(api, {})
      api.servers.servers.testServer = serverObject
      return api.servers.servers.testServer.start()
    }
  }
}
