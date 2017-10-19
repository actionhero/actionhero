'use strict'

const REPL = require('repl')
const {promisify} = require('util')
const ActionHero = require('./../../index.js')
const api = ActionHero.api

module.exports = class Console extends ActionHero.CLI {
  constructor () {
    super()
    this.name = 'console'
    this.description = 'start an interactive REPL session with the api object in-scope'
  }

  async sleep (time) {
    return promisify(setTimeout)(time)
  }

  async run () {
    for (let i in api.config.servers) { api.config.servers[i].enabled = false }
    api.config.general.developmentMode = false
    api.config.tasks.scheduler = false
    api.config.tasks.queues = []
    api.config.tasks.minTaskProcessors = 0
    api.config.tasks.maxTaskProcessors = 0

    await api.commands.start.call(api._context)
    await this.sleep(500)

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
