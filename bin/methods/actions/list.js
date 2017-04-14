'use strict'

module.exports = {
  name: 'actions list',
  description: 'I will list the actions defined on this server',

  run: function (api, data, next) {
    for (let actionName in api.actions.actions) {
      api.log(actionName)
      let collection = api.actions.actions[actionName]

      for (let version in collection) {
        let action = collection[version]
        api.log(`  version: ${version}`)
        api.log(`    ${action.description}`)
        api.log(`    inputs:`)
        for (let input in action.inputs) {
          api.log(`      ${input}: ${JSON.stringify(action.inputs[input])}`)
        }
      }
    }

    next(null)
  }
}
