'use strict'

const ActionHero = require('./../../../index.js')
const api = ActionHero.api

module.exports = class TaskEnqueue extends ActionHero.CLI {
  constructor () {
    super()
    this.name = 'task enqueue'
    this.description = 'enqueue a defined task into your actionhero cluster'
    this.example = 'actionhero task enqueue --name=[taskName] --args=[JSON-formatted args]'
    this.inputs = {
      name: {required: true},
      args: {required: false},
      params: {required: false}
    }
  }

  async run ({params}) {
    if (!api.tasks.tasks[params.name]) { throw new Error('Task "' + params.name + '" not found') }

    let args = {}
    if (params.args) { args = JSON.parse(params.args) }
    if (params.params) { args = JSON.parse(params.params) }

    await api.resque.startQueue()
    let toRun = await api.tasks.enqueue(params.name, args)
    api.log('response', 'info', toRun)
    return true
  }
}
