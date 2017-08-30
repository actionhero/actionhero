'use strict'

const REPL = require('repl')

module.exports = {
  name: 'console',
  description: 'start an interactive REPL session with the api object in-scope',

  run: async function (api, data) {
    let startSleep = 500

    for (let i in api.config.servers) { api.config.servers[i].enabled = false }
    api.config.general.developmentMode = false
    api.config.tasks.scheduler = false
    api.config.tasks.queues = []
    api.config.tasks.minTaskProcessors = 0
    api.config.tasks.maxTaskProcessors = 0

    await api.commands.start.call(api._context)
    await new Promise((resolve, reject) => {
      setTimeout(() => {
        const repl = REPL.start({
          prompt: '[ AH::' + api.env + ' ] >> ',
          input: process.stdin,
          output: process.stdout,
          useGlobal: false
        })

        repl.context.api = api

        repl.on('exit', resolve)
        repl.on('error', reject)
      }, startSleep)
    })

    return true
  }
}
