'use strict'

const fs = require('fs')
const path = require('path')
const ActionHero = require('./../../../index.js')
const api = ActionHero.api

module.exports = class GenerateCLI extends ActionHero.CLI {
  constructor () {
    super()
    this.name = 'generate cli'
    this.description = 'generate a new cli command'
    this.example = 'actionhero generate cli --name=[name]'
    this.inputs = {
      name: {required: true},
      description: {required: false, default: 'an actionhero cli command'},
      example: {required: false, default: 'actionhero command --option=yes'}
    }
  }

  run ({params}) {
    let template = fs.readFileSync(path.join(__dirname, '/../../templates/cli.js'))
    template = String(template);

    [
      'name',
      'description',
      'example'
    ].forEach((v) => {
      let regex = new RegExp('%%' + v + '%%', 'g')
      template = template.replace(regex, params[v])
    })

    let message = api.utils.createFileSafely(api.config.general.paths.cli[0] + '/' + params.name + '.js', template)
    console.log(message)

    return true
  }
}
