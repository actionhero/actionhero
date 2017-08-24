'use strict'
const fs = require('fs')
const objects = ['task', 'action', 'console']

module.exports = {
  loadPriority: 200,
  startPriority: 200,
  initialize: function (api, next) {
    // defaults
    let loaders = {
      task: require,
      action:require,
      console: null
    }

    // last loader defined is the one that is used
    api.config.general.paths.loaders.forEach(function (path) {
      objects.forEach(function (object) {
        let loaderPath = `${path}/${object}.js`
        if (fs.existsSync(loaderPath)) {
          loaders[object] = require(loaderPath)
        }
      })
    })
    api.config.loaders = loaders
    next()
  }
}
