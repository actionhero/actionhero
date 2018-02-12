const ActionHero = require('./../index.js')
const api = ActionHero.api

module.exports = class LambdaServer extends ActionHero.Server {
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

  initialize () {}

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

    if (actionName === 'file') {
      await api.servers.servers.lambda.processFile(connection)
    } else {
      await api.servers.servers.lambda.processAction(connection)
    }
  }

  sendMessage (connection, message) {
    const response = {
      statusCode: 200,
      headers: {'Content-type': 'application/json'},
      body: JSON.stringify({
        message: message,
        input: connection.rawConnection.event
      })
    }

    let error = null
    if (message.error) { error = new Error(message.error) }
    connection.rawConnection.callback(error, response)

    connection.destroy()
  }

  sendFile (connection, error, fileStream, mime, length) {
    if (error) {
      return connection.sendMessage({error})
    }

    let buffer = Buffer.alloc(0)
    fileStream.on('data', (chunk) => { buffer = Buffer.concat([buffer, chunk]) })
    fileStream.on('end', () => {
      const response = {
        statusCode: 200,
        headers: {'Content-type': mime},
        body: buffer.toString('base64'),
        // body: fileStream.toString('base64'),
        isBase64Encoded: true
      }

      connection.rawConnection.callback(null, response)

      connection.destroy()
    })
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

      if (this.config.returnMetadata) {
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
