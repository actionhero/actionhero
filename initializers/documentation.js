'use strict'

const ActionHero = require('./../index.js')

module.exports = class Documentation extends ActionHero.Initializer {
  constructor () {
    super()
    this.name = 'documentation'
    this.loadPriority = 999
  }

  initialize (api) {
    api.documentation = {
      documentation: {},

      build: () => {
        let action
        for (let i in api.actions.actions) {
          for (let j in api.actions.actions[i]) {
            action = api.actions.actions[i][j]
            if (action.toDocument !== false) {
              if (!api.documentation.documentation[action.name]) { api.documentation.documentation[action.name] = {} }
              api.documentation.documentation[action.name][action.version] = {
                name: action.name,
                version: action.version,
                description: action.description,
                inputs: action.inputs,
                outputExample: action.outputExample
              }
            }
          }
        }
      }
    }

    api.documentation.build()
  }
}
