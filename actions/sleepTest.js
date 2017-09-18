'use strict'
const ActionHero = require('./../index.js')

module.exports = class CacheTest extends ActionHero.Action {
  constructor () {
    super()
    this.name = 'sleepTest'
    this.description = 'I will sleep and then return'
    this.outputExample = {
      'sleepStarted': 1420953571322,
      'sleepEnded': 1420953572327,
      'sleepDelta': 1005,
      'sleepDuration': 1000
    }
  }

  inputs () {
    return {
      sleepDuration: {
        required: true,
        formatter: (n) => { return parseInt(n) },
        default: () => { return 1000 }
      }
    }
  }

  async run (api, data) {
    let sleepDuration = data.params.sleepDuration
    let sleepStarted = new Date().getTime()

    await new Promise((resolve) => { setTimeout(resolve, sleepDuration) })
    let sleepEnded = new Date().getTime()
    let sleepDelta = sleepEnded - sleepStarted

    data.response.sleepStarted = sleepStarted
    data.response.sleepEnded = sleepEnded
    data.response.sleepDelta = sleepDelta
    data.response.sleepDuration = sleepDuration
  }
}
