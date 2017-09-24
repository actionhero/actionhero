'use strict'
const ActionHero = require('actionhero')

module.exports = class MyTask extends ActionHero.Task {
  constructor () {
    super()
    this.name = '%%name%%'
    this.description = '%%description%%'
    this.frequency = %%frequency%%
    this.queue = '%%queue%%'
    this.middleware = []
  }

  async run (api, data) {
    // your logic here
  }
}
