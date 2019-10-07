'use strict'
const { CLI } = require('actionhero')

module.exports = class MyCLICommand extends CLI {
  constructor () {
    super()
    this.name = '%%name%%'
    this.description = '%%description%%'
    this.example = '%%example%%'
    this.inputs = {}
  }

  async run (data) {
    return true
  }
}
