const ActionHero = require('./../../../index.js')

module.exports = class PlutingTask extends ActionHero.Task {
  constructor () {
    super()
    this.name = 'pluginTask'
    this.description = 'pluginTask'
    this.frequency = 0
    this.queue = 'default'
  }

  async run (params) {
    return true
  }
}
