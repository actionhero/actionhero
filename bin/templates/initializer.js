'use strict'
const ActionHero = require('actionhero')

module.exports = class MyCLICommand extends ActionHero.Initializer {
  constructor () {
    super()
    this.name = '%%name%%'
    this.loadPriority = %%loadPriority%%
    this.startPriority = %%startPriority%%
    this.stopPriority = %%stopPriority%%
  }

  async initialize (api) {
    api['%%name%%'] = {}
  }

  async start (api) {}
  async stop (api) {}
}
