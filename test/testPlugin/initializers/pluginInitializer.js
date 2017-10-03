const {api, Initializer} = require('./../../../index.js')

module.exports = class PluginInitializer extends Initializer {
  constructor () {
    super()
    this.name = 'pluginInitializer'
  }

  initialize () {
    api.pluginInitializer = { here: true }
  }

  stop () {
    // this seems silly, but is needed for testing, as we never clear properties on the API object
    delete api.pluginInitializer
  }
}
