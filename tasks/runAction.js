const task = {
  name: 'runAction',
  description: 'I will run an action and return the connection object',
  queue: 'default',
  plugins: [],
  pluginOptions: [],
  frequency: 0,
  run: function (api, params, next) {
    if (!params) { params = {} }

    const connection = new api.Connection({
      type: 'task',
      remotePort: '0',
      remoteIP: '0',
      rawConnection: {}
    })

    connection.params = params

    const ActionProcessor = new api.ActionProcessor(connection, function (data) {
      if (data.response.error) {
        api.log('task error: ' + data.response.error, 'error', {params: JSON.stringify(params)})
      } else {
        api.log('[ action @ task ]', 'debug', {params: JSON.stringify(params)})
      }

      connection.destroy(function () {
        next(data.response.error, data.response)
      })
    })

    ActionProcessor.processAction()
  }
}

exports.task = task
