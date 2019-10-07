'use strict'
const ActionHero = require('./../../../index.js')
const api = ActionHero.api

module.exports = class ActionsList extends ActionHero.CLI {
  constructor () {
    super()
    this.name = 'actions list'
    this.description = 'I will list the actions defined on this server'
  }

  run () {
    for (const actionName in api.actions.actions) {
      console.log(`\r\n--- ${actionName} ---`)
      const collection = api.actions.actions[actionName]

      for (const version in collection) {
        const action = collection[version]
        console.info(`  version: ${version}`)
        console.info(`    ${action.description}`)
        console.info('    inputs:')
        for (const input in action.inputs) {
          console.info(`      ${input}: ${JSON.stringify(action.inputs[input])}`)
        }
      }
    }

    return true
  }
}
