'use strict'

const fs = require('fs')
const path = require('path')
const ActionHero = require('./../../../index.js')
const api = ActionHero.api
const PackageJSON = require(path.join(__dirname, '..', '..', '..', 'package.json'))

module.exports = class GeneratePlugin extends ActionHero.CLI {
  constructor () {
    super()
    this.name = 'generate plugin'
    this.description = 'generate the structure of a new actionhero plugin in an empty directory'
    this.example = 'actionhero generate plugin'
    this.inputs = {}
  }

  run () {
    let template = fs.readFileSync(path.join(__dirname, '/../../templates/package-plugin.json'))
    template = String(template)

    let regex = new RegExp('%%versionNumber%%', 'g')
    template = template.replace(regex, PackageJSON.version);

    [
      'actions',
      'tasks',
      'initializers',
      'servers',
      'config',
      'bin',
      'public'
    ].forEach((type) => {
      try {
        let message = api.utils.createDirSafely(path.join(process.cwd(), type), template)
        console.info(message)
      } catch (error) {
        console.log(error.toString())
      }
    })

    let message = api.utils.createFileSafely(path.join(process.cwd(), 'package.json'), template)
    console.info(message)

    return true
  }
}
