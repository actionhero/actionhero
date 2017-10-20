'use strict'

/**
 * Collects and formats allowed params for this server.
 *
 * @namespace api.params
 */

module.exports = {
  loadPriority: 420,
  initialize: function (api, next) {
    api.params = {}

    // special params we will always accept
    api.params.globalSafeParams = [
      'file',
      'apiVersion',
      'callback',
      'action'
    ]

    api.params.buildPostVariables = function () {
      let postVariables = []
      let i
      let j

      api.params.globalSafeParams.forEach(function (p) {
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
    next()
  }
}
