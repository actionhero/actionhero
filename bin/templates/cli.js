'use strict'

const ActionHero = require('actionhero')

module.exports = class RandomNumber extends ActionHero.Action {
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
