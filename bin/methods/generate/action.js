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
      name: { required: true },
      description: { required: true, default: 'an actionhero action' }
    }
  }

  run ({ params }) {
    let actionTemplate = fs.readFileSync(path.join(__dirname, '../../templates/action.js'))
    actionTemplate = String(actionTemplate)
    let testTemplate = fs.readFileSync(path.join(__dirname, '/../../templates/test/action.js'))
    testTemplate = String(testTemplate);

    [
      'name',
      'description'
    ].forEach((v) => {
      const regex = new RegExp('%%' + v + '%%', 'g')
      actionTemplate = actionTemplate.replace(regex, params[v])
      testTemplate = testTemplate.replace(regex, params[v])
    })

    let message = api.utils.createFileSafely(api.config.general.paths.action[0] + '/' + params.name + '.js', actionTemplate)
    console.info(message)
    message = api.utils.createFileSafely(api.config.general.paths.test[0] + '/actions/' + params.name + '.js', testTemplate)
    console.info(message)

    return true
  }
}
