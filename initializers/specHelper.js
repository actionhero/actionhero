'use strict'

const uuid = require('uuid')
const NR = require('node-resque')

/**
 * A speical "mock" server which enables you to test actions and tasks in a simple way.  Only availalbe in the TEST environment.
 *
 * @namespace api.specHelper
 * @property {Boolean} enabled - Is the specHelper server enabled
 * @property {Object} Server - The instnace of the SpecHelper server
 */

module.exports = {
  startPriority: 901,
  loadPriority: 900,
  initialize: function (api, next) {
    if (api.env === 'test' || process.env.SPECHELPER === 'true' || process.env.SPECHELPER === true) {
      api.specHelper = {
        returnMetadata: true
      }

      // create a test 'server' to run actions
      api.specHelper.initialize = function (api, options, next) {
        const type = 'testServer'
        const attributes = {
          canChat: true,
          logConnections: false,
          logExits: false,
          sendWelcomeMessage: true,
          verbs: api.connections.allowedVerbs
        }

        const server = new api.GenericServer(type, options, attributes)

        server.start = function (next) {
          api.log('loading the testServer', 'warning')
          next()
        }

        server.stop = function (next) {
          next()
        }

        server.sendMessage = function (connection, message, messageCount) {
          process.nextTick(() => {
            connection.messages.push(message)
            if (typeof connection.actionCallbacks[messageCount] === 'function') {
              connection.actionCallbacks[messageCount](message, connection)
              delete connection.actionCallbacks[messageCount]
            }
          })
        }

        server.sendFile = function (connection, error, fileStream, mime, length) {
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

        server.goodbye = function () {
          //
        }

        server.on('connection', function (connection) {
          connection.messages = []
          connection.actionCallbacks = {}
        })

        server.on('actionComplete', function (data) {
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

        next(server)
      }

      /**
       * A special connection usable in tests.  Create via `new api.specHelper.Connection()`
       *
       * @memberof api.specHelper
       */
      api.specHelper.connection = function () {
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

      /**
       * Run an action via the specHelper server.
       *
       * @async
       * @param  {string}  actionName The name of the action to run.
       * @param  {Object}  input      You can provide either a pre-build connection `new api.specHelper.Connection()`, or just a Object with params for your action.
       * @param  {nextCallback} callback The callback that handles the response.
       */
      api.specHelper.runAction = function (actionName, input, next) {
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

      /**
       * This callback is invoked with the response from the action.
       * @callback nextCallback
       * @param {object} response The response from the action.
       */

      /**
       * Mock a specHelper connection requesting a file from the server.
       *
       * @async
       * @param  {string}  file The name & path of the file to request.
       * @param  {fileCallback} callback The callback that handles the response.
       * @return {Promise<Object>} The body contents and metadata of the file requested.  Conatins: mime, length, body, and more.
       */
      api.specHelper.getStaticFile = function (file, next) {
        let connection = new api.specHelper.Connection()
        connection.params.file = file

        connection.messageCount++
        if (typeof next === 'function') {
          connection.actionCallbacks[(connection.messageCount)] = next
        }

        api.servers.servers.testServer.processFile(connection)
      }

      /**
       * This callback is invoked with the body contents and metadata of the
       * requested file. Conatins: mime, length, body, and more.
       * @callback fileCallback
       * @param {object} file The requested file.
       */

      /**
       * Use the specHelper to run a task.
       * Note: this only runs the task's `run()` method, and no middleware.  This is faster than api.specHelper.runFullTask.
       *
       * @param  {string}   taskName The name of the task.
       * @param  {Object}   params   Params to pass to the task
       * @param  {taskCallback} next  The callback that handles the response.
       * @see api.specHelper.runFullTask
       */
      api.specHelper.runTask = function (taskName, params, next) {
        api.tasks.tasks[taskName].run(api, params, next)
      }

      /**
       * This callback is invoked with an error or the return value from a task.
       * @callback taskCallback
       * @param {Error} error An error or null.
       * @param {object} returnValue A return value from the task.
       */

      /**
       * Use the specHelper to run a task.
       * Note: this will run a full Task worker, and will also include any middleware.  This is slower than api.specHelper.runTask.
       *
       * @param  {string}   taskName The name of the task.
       * @param  {Object}   params   Params to pass to the task
       * @param  {taskCallback} next  The callback that handles the response.
       * @see api.specHelper.runTask
       */
      api.specHelper.runFullTask = function (taskName, params, next) {
        let options = {
          connection: api.redis.clients.tasks,
          queues: api.config.tasks.queues || ['default']
        }

        let worker = new NR.worker(options, api.tasks.jobs) // eslint-disable-line
        worker.connect((error) => {
          if (error) {
            return next(error)
          }

          worker.performInline(taskName, params, (error, result) => {
            worker.end()
            next(error, result)
          })
        })
      }

      next()
    } else {
      next()
    }
  },

  start: function (api, next) {
    if (api.env === 'test' || process.env.SPECHELPER === 'true' || process.env.SPECHELPER === true) {
      api.specHelper.initialize(api, {}, (serverObject) => {
        api.servers.servers.testServer = serverObject
        api.servers.servers.testServer.start(() => {
          next()
        })
      })
    } else {
      next()
    }
  }
}
