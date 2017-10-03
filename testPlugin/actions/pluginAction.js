'use strict'
const ActionHero = require('actionhero')

module.exports = class PluginAction extends ActionHero.Action {
  constructor () {
    super()
    this.name = 'pluginAction'
    this.description = 'pluginAction'
    this.outputExample = {}
  }

  async run ({response}) {
    response.cool = true
  }
}
