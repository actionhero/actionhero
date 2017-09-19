'use strict'
const ActionHero = require('actionhero')

module.exports = class MyAction extends ActionHero.Action {
  constructor () {
    super()
    this.name = '%%name%%'
    this.description = '%%description%%'
    this.outputExample = {}
  }

  async run (api, data) {
    // your logic here
  }
}
