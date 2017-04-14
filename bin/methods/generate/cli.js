'use strict'

const fs = require('fs')
const path = require('path')

module.exports = {
  name: 'generate cli',
  description: 'generate a new cli command',
  example: 'actionhero generate cli --name=[name]',

  inputs: {
    name: {required: true},
    description: {required: false, default: 'an actionhero cli command'},
    example: {required: false, default: 'actionhero command --option=yes'}
  },

  run: function (api, data, next) {
    let template = fs.readFileSync(path.join(__dirname, '/../../templates/cli.js'))
    template = String(template);

    [
      'name',
      'description',
      'example'
    ].forEach(function (v) {
      let regex = new RegExp('%%' + v + '%%', 'g')
      template = template.replace(regex, data.params[v])
    })

    api.utils.createFileSafely(api.config.general.paths.cli[0] + '/' + data.params.name + '.js', template)

    next(null, true)
  }
}
