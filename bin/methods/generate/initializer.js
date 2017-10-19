'use strict'

const fs = require('fs')
const path = require('path')
const ActionHero = require('./../../../index.js')
const api = ActionHero.api

module.exports = class GenerateInitializer extends ActionHero.CLI {
  constructor () {
    super()
    this.name = 'generate initializer'
    this.description = 'generate a new initializer'
    this.example = 'actionhero generate initializer --name=[name] --loadPriority=[p] --startPriority=[p] --stopPriority=[p]'
    this.inputs = {
      name: {required: true},
      loadPriority: {required: true, default: 1000},
      startPriority: {required: true, default: 1000},
      stopPriority: {required: true, default: 1000}
    }
  }

  run ({params}) {
    let template = fs.readFileSync(path.join(__dirname, '/../../templates/initializer.js'))
    template = String(template);

    [
      'name',
      'loadPriority',
      'startPriority',
      'stopPriority'
    ].forEach((v) => {
      let regex = new RegExp('%%' + v + '%%', 'g')
      template = template.replace(regex, params[v])
    })

    let message = api.utils.createFileSafely(api.config.general.paths.initializer[0] + '/' + params.name + '.js', template)
    console.log(message)

    return true
  }
}
