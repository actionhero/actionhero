const task = {
  name: 'runAction',
  description: 'I will run an action and return the connection object',
  queue: 'default',
  plugins: [],
  pluginOptions: [],
  frequency: 0,
  run: async (api, params) => {
    if (!params) { params = {} }

    const connection = new api.Connection({
      type: 'task',
      remotePort: '0',
      remoteIP: '0',
      rawConnection: {}
    })

    connection.params = params

    const actionProcessor = new api.ActionProcessor(connection)
    let data = await actionProcessor.processAction()

    if (data.response.error) {
      api.log('task error: ' + data.response.error, 'error', {params: JSON.stringify(params)})
    } else {
      api.log('[ action @ task ]', 'debug', {params: JSON.stringify(params)})
    }

    connection.destroy()
    return data.response
  }
}

exports.task = task
