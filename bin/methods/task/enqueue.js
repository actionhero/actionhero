'use strict'

module.exports = {
  name: 'task enqueue',
  description: 'enqueue a defined task into your actionhero cluster',
  example: 'actionhero task enqueue --name=[taskName] --args=[JSON-formatted args]',

  inputs: {
    name: {required: true},
    args: {required: false},
    params: {required: false}
  },

  run: async function (api, data) {
    if (!api.tasks.tasks[data.params.name]) { throw new Error('Task "' + data.params.name + '" not found') }

    let args = {}
    if (data.params.args) { args = JSON.parse(data.params.args) }
    if (data.params.params) { args = JSON.parse(data.params.params) }

    await api.resque.startQueue()
    let toRun = await api.tasks.enqueue(data.params.name, args)
    api.log('response', 'info', toRun)
    return true
  }
}
