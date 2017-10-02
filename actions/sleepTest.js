'use strict'
const {promisify} = require('util')
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

  async sleep (time) {
    return promisify(setTimeout)(time)
  }

  async run ({response, params}) {
    let sleepDuration = params.sleepDuration
    let sleepStarted = new Date().getTime()

    await this.sleep(sleepDuration)
    let sleepEnded = new Date().getTime()
    let sleepDelta = sleepEnded - sleepStarted

    response.sleepStarted = sleepStarted
    response.sleepEnded = sleepEnded
    response.sleepDelta = sleepDelta
    response.sleepDuration = sleepDuration
  }
}
