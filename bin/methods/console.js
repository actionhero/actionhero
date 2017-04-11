'use strict'

const REPL = require('repl')

module.exports = {
  name: 'console',
  description: 'start an interactive REPL session with the api object in-scope',

  run: function (api, data, next) {
    for (let i in api.config.servers) { api.config.servers[i].enabled = false }
    api.config.general.developmentMode = false
    api.config.tasks.scheduler = false
    api.config.tasks.queues = []
    api.config.tasks.minTaskProcessors = 0
    api.config.tasks.maxTaskProcessors = 0

    api.commands.start.call(api._context, function (error) {
      if (error) { return next(error) }

      setTimeout(() => {
        const repl = REPL.start({
          prompt: '[ AH::' + api.env + ' ] >> ',
          input: process.stdin,
          output: process.stdout,
          useGlobal: false
        })

        repl.context.api = api

        repl.on('exit', function () {
          next(null, true)
        })
      }, 500)
    })
  }
}
