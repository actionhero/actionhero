'use strict'

const uuid = require('uuid')
const NR = require('node-resque')

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

        server.on('actionComplete', (data) => {
          if (typeof data.response === 'string' || Array.isArray(data.response)) {
            if (data.response.error) {
              data.response = api.config.errors.serializers.servers.specHelper(data.response.error)
            }
          } else {
            if (data.response.error) {
              data.response.error = api.config.errors.serializers.servers.specHelper(data.response.error)
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

      api.specHelper.connection = () => {
        let id = uuid.v4()
        api.servers.servers.testServer.buildConnection({
          id: id,
          rawConnection: {},
          remoteAddress: 'testServer',
          remotePort: 0
        })

        return api.connections.connections[id]
      }

      api.specHelper.Connection = api.specHelper.connection

      // create helpers to run an action
      // data can be a params hash or a connection
      api.specHelper.runAction = (actionName, input, next) => {
        let connection
        if (typeof input === 'function' && !next) {
          next = input
          input = {}
        }
        if (input.id && input.type === 'testServer') {
          connection = input
        } else {
          connection = new api.specHelper.Connection()
          connection.params = input
        }
        connection.params.action = actionName

        connection.messageCount++
        if (typeof next === 'function') {
          connection.actionCallbacks[(connection.messageCount)] = next
        }

        process.nextTick(() => {
          api.servers.servers.testServer.processAction(connection)
        })
      }

      // helpers to get files
      api.specHelper.getStaticFile = async (file, next) => {
        let connection = new api.specHelper.Connection()
        connection.params.file = file

        connection.messageCount++
        if (typeof next === 'function') {
          connection.actionCallbacks[(connection.messageCount)] = next
        }

        await api.servers.servers.testServer.processFile(connection)
      }

      // create helpers to run a task
      api.specHelper.runTask = async (taskName, params, next) => {
        return api.tasks.tasks[taskName].run(api, params)
      }

      api.specHelper.runFullTask = async (taskName, params) => {
        let options = {
          connection: api.redis.clients.tasks,
          queues: api.config.tasks.queues || ['default']
        }

        let worker = new NR.worker(options, api.tasks.jobs) // eslint-disable-line
        await new Promise((resolve, reject) => {
          worker.connect((error) => {
            if (error) { return reject(error) }

            worker.performInline(taskName, params, (error, result) => {
              worker.end()
              if (error) { return reject(error) }
              resolve(error)
            })
          })
        })
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
