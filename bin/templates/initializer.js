'use strict'
const ActionHero = require('actionhero')

module.exports = class MyInitializer extends ActionHero.Initializer {
  constructor () {
    super()
    this.name = '%%name%%'
    this.loadPriority = %%loadPriority%%
    this.startPriority = %%startPriority%%
    this.stopPriority = %%stopPriority%%
  }

  async initialize () {
    ActionHero.api['%%name%%'] = {} //eslint-disable-line
  }

  async start () {}

  async stop () {}
}
