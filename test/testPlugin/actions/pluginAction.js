const ActionHero = require('./../../../index.js')

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
