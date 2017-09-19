const task = {
  name: 'runAction',
  description: 'I will run an action and return the connection object',
  queue: 'default',
  plugins: [],
  pluginOptions: [],
  frequency: 0,
  run: async ({log, ActionProcessor, Connection}, params) => {
    if (!params) { params = {} }

    const connection = new Connection({
      type: 'task',
      remotePort: '0',
      remoteIP: '0',
      rawConnection: {}
    })

    connection.params = params

    const actionProcessor = new ActionProcessor(connection)
    let {response} = await actionProcessor.processAction()

    if (response.error) {
      log('task error: ' + response.error, 'error', {params: JSON.stringify(params)})
    } else {
      log('[ action @ task ]', 'debug', {params: JSON.stringify(params)})
    }

    connection.destroy()
    return response
  }
}

exports.task = task
