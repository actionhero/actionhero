'use strict'

const fs = require('fs')
const path = require('path')

module.exports = {
  name: 'generate task',
  description: 'generate a new task',
  example: 'actionhero generate task --name=[name] --description=[description] --scope=[scope] --frequency=[frequency]',

  inputs: {
    name: {required: true},
    queue: {required: true},
    description: {required: true, default: 'an actionhero task'},
    frequency: {required: true, default: 0}
  },

  run: function (api, data, next) {
    let template = fs.readFileSync(path.join(__dirname, '/../../templates/task.js'))
    template = String(template);

    [
      'name',
      'description',
      'queue',
      'frequency'
    ].forEach(function (v) {
      let regex = new RegExp('%%' + v + '%%', 'g')
      template = template.replace(regex, data.params[v])
    })

    api.utils.createFileSafely(api.config.general.paths.task[0] + '/' + data.params.name + '.js', template)

    next(null, true)
  }
}
