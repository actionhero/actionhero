'use strict'

exports.sleepTest = {
  name: 'sleepTest',
  description: 'I will sleep and then return',

  inputs: {
    sleepDuration: {
      required: true,
      formatter: function (n) { return parseInt(n) },
      default: function () { return 1000 }
    }
  },

  outputExample: {
    'sleepStarted': 1420953571322,
    'sleepEnded': 1420953572327,
    'sleepDelta': 1005,
    'sleepDuration': 1000
  },

  run: async function (api, data, next) {
    let sleepDuration = data.params.sleepDuration
    let sleepStarted = new Date().getTime()

    await new Promise((resolve) => { setTimeout(resolve, sleepDuration) })
    let sleepEnded = new Date().getTime()
    let sleepDelta = sleepEnded - sleepStarted

    data.response.sleepStarted = sleepStarted
    data.response.sleepEnded = sleepEnded
    data.response.sleepDelta = sleepDelta
    data.response.sleepDuration = sleepDuration

    next()
  }
}
