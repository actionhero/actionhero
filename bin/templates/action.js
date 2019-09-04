'use strict'
const { Action } = require('actionhero')

module.exports = class MyAction extends Action {
  constructor () {
    super()
    this.name = '%%name%%'
    this.description = '%%description%%'
    this.outputExample = {}
  }

  async run (data) {
    // your logic here
    data.response.ok = true
  }
}
