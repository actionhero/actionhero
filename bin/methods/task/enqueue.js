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

  run: function (api, data, next) {
    if (!api.tasks.tasks[data.params.name]) { throw new Error('Task "' + data.params.name + '" not found') }

    let args = {}
    if (data.params.args) { args = JSON.parse(data.params.args) }
    if (data.params.params) { args = JSON.parse(data.params.params) }

    api.resque.startQueue(function () {
      api.tasks.enqueue(data.params.name, args, function (error, toRun) {
        if (error) {
          api.log(error, 'alert')
        } else {
          api.log('response', 'info', toRun)
        }
        next(null, true)
      })
    })
  }
}
