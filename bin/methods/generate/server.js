'use strict'

const fs = require('fs')
const path = require('path')

module.exports = {
  name: 'generate server',
  description: 'generate a new server',
  example: 'actionhero generate server --name=[name]',

  inputs: {
    name: {required: true}
  },

  run: function (api, data, next) {
    let template = fs.readFileSync(path.join(__dirname, '/../../templates/server.js'))
    template = String(template);

    [
      'name'
    ].forEach(function (v) {
      let regex = new RegExp('%%' + v + '%%', 'g')
      template = template.replace(regex, data.params[v])
    })

    api.utils.createFileSafely(api.config.general.paths.server[0] + '/' + data.params.name + '.js', template)

    next(null, true)
  }
}
