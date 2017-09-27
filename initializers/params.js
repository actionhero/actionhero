'use strict'

const ActionHero = require('./../index.js')
const api = ActionHero.api

/**
 * Collects and formats allowed params for this server.
 *
 * @namespace api.params
 * @extends ActionHero.Initializer
 */
module.exports = class Params extends ActionHero.Initializer {
  constructor () {
    super()
    this.name = 'params'
    this.loadPriority = 420
  }

  initialize () {
    api.params = {
      postVariables: []
    }

    // special params we will always accept
    api.params.globalSafeParams = [
      'file',
      'apiVersion',
      'callback',
      'action'
    ]

    api.params.buildPostVariables = () => {
      let postVariables = []
      let i
      let j

      api.params.globalSafeParams.forEach((p) => {
        postVariables.push(p)
      })

      for (i in api.actions.actions) {
        for (j in api.actions.actions[i]) {
          let action = api.actions.actions[i][j]
          for (let key in action.inputs) {
            postVariables.push(key)
          }
        }
      }

      api.params.postVariables = api.utils.arrayUniqueify(postVariables)
      return api.params.postVariables
    }

    api.params.buildPostVariables()
  }
}
