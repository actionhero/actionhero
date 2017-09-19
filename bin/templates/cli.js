'use strict'

const ActionHero = require('actionhero')

module.exports = class MyCLICommand extends ActionHero.Action {
  constructor () {
    super()
    this.name = '%%name%%'
    this.description = '%%description%%'
    this.example = '%%example%%'
    this.inputs = {}
  }

  async run (api, data) {
    return true
  }
}
