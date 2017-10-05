'use strict'

const path = require('path')
const packageJSON = require(path.join(__dirname, '/../../package.json'))
const ActionHero = require('./../../index.js')

module.exports = class Version extends ActionHero.CLI {
  constructor () {
    super()
    this.name = 'version'
    this.description = 'return the ActionHero version within this project'
  }

  run (data) {
    console.log(packageJSON.version)
    return true
  }
}
