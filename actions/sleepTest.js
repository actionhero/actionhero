'use strict'
const ActionHero = require('./../index.js')

module.exports = class CacheTest extends ActionHero.Action {
  constructor () {
    super()
    this.name = 'sleepTest'
    this.description = 'I will sleep and then return'
    this.outputExample = {
      sleepStarted: 1420953571322,
      sleepEnded: 1420953572327,
      sleepDelta: 1005,
      sleepDuration: 1000
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

  async run ({ response, params }) {
    const sleepDuration = params.sleepDuration
    const sleepStarted = new Date().getTime()

    await ActionHero.api.utils.sleep(sleepDuration)
    const sleepEnded = new Date().getTime()
    const sleepDelta = sleepEnded - sleepStarted

    response.sleepStarted = sleepStarted
    response.sleepEnded = sleepEnded
    response.sleepDelta = sleepDelta
    response.sleepDuration = sleepDuration
  }
}
