'use strict'

const fs = require('fs')
const path = require('path')

module.exports = {
  name: 'generate initializer',
  description: 'generate a new initializer',
  example: 'actionhero generate initializer --name=[name] --loadPriority=[p] --startPriority=[p] --stopPriority=[p]',

  inputs: {
    name: {required: true},
    loadPriority: {required: true, default: 1000},
    startPriority: {required: true, default: 1000},
    stopPriority: {required: true, default: 1000}
  },

  run: function (api, data, next) {
    let template = fs.readFileSync(path.join(__dirname, '/../../templates/initializer.js'))
    template = String(template);

    [
      'name',
      'loadPriority',
      'startPriority',
      'stopPriority'
    ].forEach(function (v) {
      let regex = new RegExp('%%' + v + '%%', 'g')
      template = template.replace(regex, data.params[v])
    })

    api.utils.createFileSafely(api.config.general.paths.initializer[0] + '/' + data.params.name + '.js', template)

    next(null, true)
  }
}
