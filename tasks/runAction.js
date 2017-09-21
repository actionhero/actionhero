'use strict'
const ActionHero = require('./../index.js')

module.exports = class RunAction extends ActionHero.Task {
  constructor () {
    super()
    this.name = 'runAction'
    this.description = 'I will run an action and return the connection object'
    this.frequency = 0
    this.queue = 'default'
    this.middleware = []
  }

  async run (api, params) {
    if (!params) { params = {} }

    const connection = new ActionHero.Connection(api, {
      type: 'task',
      remotePort: '0',
      remoteIP: '0',
      rawConnection: {}
    })

    connection.params = params

    const actionProcessor = new ActionHero.ActionProcessor(api, connection)
    let {response} = await actionProcessor.processAction()

    if (response.error) {
      api.log('task error: ' + response.error, 'error', {params: JSON.stringify(params)})
    } else {
      api.log('[ action @ task ]', 'debug', {params: JSON.stringify(params)})
    }

    connection.destroy()
    return response
  }
}
