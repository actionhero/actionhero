'use strict'

exports.task = {
  name: '%%name%%',
  description: '%%description%%',
  frequency: %%frequency%%,
  queue: '%%queue%%',
  middleware: [],

  run: function (api, params, next) {
    // your logic here
    // let error = new Error('something has gone wrong')
    // let resultLogMessage = {taskResult: 'ok'}
    // next(error, resultLogMessage)

    return next()
  }
}
