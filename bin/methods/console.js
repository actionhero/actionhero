'use strict'

const REPL = require('repl')
const ActionHero = require('./../../index.js')
const api = ActionHero.api

module.exports = class Console extends ActionHero.CLI {
  constructor () {
    super()
    this.name = 'console'
    this.description = 'start an interactive REPL session with the api object in-scope'
  }

  async run () {
    for (const i in api.config.servers) { api.config.servers[i].enabled = false }
    api.config.general.developmentMode = false
    api.config.tasks.scheduler = false
    api.config.tasks.queues = []
    api.config.tasks.minTaskProcessors = 0
    api.config.tasks.maxTaskProcessors = 0

    await api.commands.start.call(api._context)
    await api.utils.sleep(500)

    await new Promise((resolve, reject) => {
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
