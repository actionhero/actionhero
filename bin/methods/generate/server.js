'use strict'

const fs = require('fs')
const path = require('path')
const ActionHero = require('./../../../index.js')
const api = ActionHero.api

module.exports = class GenerateServer extends ActionHero.CLI {
  constructor () {
    super()
    this.name = 'generate server'
    this.description = 'generate a new server'
    this.example = 'actionhero generate server --name=[name]'
    this.inputs = {
      name: {required: true}
    }
  }

  run ({params}) {
    let template = fs.readFileSync(path.join(__dirname, '/../../templates/server.js'))
    template = String(template);

    [
      'name'
    ].forEach((v) => {
      let regex = new RegExp('%%' + v + '%%', 'g')
      template = template.replace(regex, params[v])
    })

    let message = api.utils.createFileSafely(api.config.general.paths.server[0] + '/' + params.name + '.js', template)
    console.log(message)

    return true
  }
}
