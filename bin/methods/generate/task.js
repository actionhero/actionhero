'use strict'

const fs = require('fs')
const path = require('path')
const ActionHero = require('./../../../index.js')
const api = ActionHero.api

module.exports = class GenerateTask extends ActionHero.CLI {
  constructor () {
    super()
    this.name = 'generate task'
    this.description = 'generate a new task'
    this.example = 'actionhero generate task --name=[name] --description=[description] --scope=[scope] --frequency=[frequency]'
    this.inputs = {
      name: {required: true},
      queue: {required: true},
      description: {required: true, default: 'an actionhero task'},
      frequency: {required: true, default: 0}
    }
  }

  run ({params}) {
    let template = fs.readFileSync(path.join(__dirname, '/../../templates/task.js'))
    template = String(template);

    [
      'name',
      'description',
      'queue',
      'frequency'
    ].forEach((v) => {
      let regex = new RegExp('%%' + v + '%%', 'g')
      template = template.replace(regex, params[v])
    })

    let message = api.utils.createFileSafely(api.config.general.paths.task[0] + '/' + params.name + '.js', template)
    console.log(message)

    return true
  }
}
