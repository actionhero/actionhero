'use strict'
const { Initializer, api } = require('actionhero')

module.exports = class MyInitializer extends Initializer {
  constructor () {
    super()
    this.name = '%%name%%'
    this.loadPriority = %%loadPriority%%
    this.startPriority = %%startPriority%%
    this.stopPriority = %%stopPriority%%
  }

  async initialize () {
    api['%%name%%'] = {} //eslint-disable-line
  }

  async start () {}

  async stop () {}
}
