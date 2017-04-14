'use strict'

const fs = require('fs')
const path = require('path')

module.exports = {
  name: 'generate action',
  description: 'generate a new action',
  example: 'actionhero generate action --name=[name] --description=[description]',

  inputs: {
    name: {required: true},
    description: {required: true, default: 'an actionhero action'}
  },

  run: function (api, data, next) {
    let template = fs.readFileSync(path.join(__dirname, '/../../templates/action.js'))
    template = String(template);

    [
      'name',
      'description'
    ].forEach(function (v) {
      let regex = new RegExp('%%' + v + '%%', 'g')
      template = template.replace(regex, data.params[v])
    })

    api.utils.createFileSafely(api.config.general.paths.action[0] + '/' + data.params.name + '.js', template)

    next(null, true)
  }
}
