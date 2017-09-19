'use strict'

const REPL = require('repl')
const ActionHero = require('./../../index.js')

module.exports = class ActionsList extends ActionHero.CLI {
  constructor () {
    super()
    this.name = 'console'
    this.description = 'start an interactive REPL session with the api object in-scope'
  }

  startSleep () {
    return 500
  }

  async run (api) {
    for (let i in api.config.servers) { api.config.servers[i].enabled = false }
    api.config.general.developmentMode = false
    api.config.tasks.scheduler = false
    api.config.tasks.queues = []
    api.config.tasks.minTaskProcessors = 0
    api.config.tasks.maxTaskProcessors = 0

    await api.commands.start.call(api._context)
    await new Promise((resolve) => { setTimeout(resolve, this.startSleep()) })

    await new Promise(async (resolve, reject) => {
      const repl = REPL.start({
        prompt: '[ AH::' + api.env + ' ] >> ',
        input: process.stdin,
        output: process.stdout,
        useGlobal: false
      })

      repl.context.api = api

      repl.on('exit', resolve)
      repl.on('error', reject)
    })

    return true
  }
}
