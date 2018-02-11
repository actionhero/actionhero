// const { Process, Server, api }  = require('actionhero')
const { Process, Server, api } = require('./index.js')

const actionhero = new Process()
const ReturnMetadata = true

class LambdaServer extends Server {
  constructor () {
    super()
    this.type = 'lambda'
    this.attributes = {
      canChat: false,
      logConnections: false,
      logExits: false,
      sendWelcomeMessage: false,
      verbs: []
    }
  }

  start (api) {
    this.on('connection', (connection) => { this.handleConnection(connection) })
    this.on('actionComplete', (data) => { this.actionComplete(data) })
  }

  stop () {}

  goodbye () {}

  async handleConnection (connection) {
    if (typeof connection.rawConnection.event === 'object') {
      connection.params = connection.rawConnection.event
    }

    const parts = connection.rawConnection.context.functionName.split('-')
    const actionName = parts[(parts.length - 1)]
    connection.params.action = actionName

    await api.servers.servers.lambda.processAction(connection)
  }

  sendMessage (connection, message) {
    const response = {
      statusCode: 200,
      body: JSON.stringify({
        message: message,
        input: connection.rawConnection.event
      })
    }

    let error = null
    if (message.error) { error = new Error(message.error) }
    connection.rawConnection.callback(error, response)

    connection.destroy()
    api.commands.stop()
  }

  sendFile (connection, error, fileStream, mime, length) {
    throw new Error('TODO')
  }

  async runFunction (event, context, callback) {
    await api.servers.servers.lambda.buildConnection({
      rawConnection: {event, context, callback},
      remoteAddress: 'lambda',
      remotePort: 0
    })
  }

  async actionComplete (data) {
    if (typeof data.response === 'string' || Array.isArray(data.response)) {
      if (data.response.error) {
        data.response = await api.config.errors.serializers.servers.specHelper(data.response.error)
      }
    } else {
      if (data.response.error) {
        data.response.error = await api.config.errors.serializers.servers.specHelper(data.response.error)
      }

      if (ReturnMetadata) {
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

// Run!

const sleep = async (time = 100) => {
  return new Promise((resolve) => { setTimeout(resolve, time) })
}

const checkRunning = async () => {
  if (api.running !== true) {
    await sleep()
    return checkRunning()
  }
}

(async () => {
  module.exports.action = async (event, context, callback) => {
    await checkRunning()
    await api.servers.servers.lambda.runFunction(event, context, callback)
  }

  await actionhero.start()
  let server = new LambdaServer()
  server.config = { enabled: true }
  await server.start(api)
  api.servers.servers.lambda = server
})()
