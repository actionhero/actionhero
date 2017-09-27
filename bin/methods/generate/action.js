'use strict'

const fs = require('fs')
const path = require('path')
const ActionHero = require('./../../../index.js')
const api = ActionHero.api

module.exports = class GenerateAction extends ActionHero.CLI {
  constructor () {
    super()
    this.name = 'generate action'
    this.description = 'generate a new action'
    this.example = 'actionhero generate action --name=[name] --description=[description]'
    this.inputs = {
      name: {required: true},
      description: {required: true, default: `an actionhero action`}
    }
  }

  run ({params}) {
    let template = fs.readFileSync(path.join(__dirname, '/../../templates/action.js'))
    template = String(template);

    [
      'name',
      'description'
    ].forEach((v) => {
      let regex = new RegExp('%%' + v + '%%', 'g')
      template = template.replace(regex, params[v])
    })

    let message = api.utils.createFileSafely(api.config.general.paths.action[0] + '/' + params.name + '.js', template)
    console.info(message)

    return true
  }
}
