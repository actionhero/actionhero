'use strict'

const path = require('path')
const packageJSON = require(path.join(__dirname, '/../../package.json'))

module.exports = function (api, next) {
  console.log(packageJSON.version)
  next(null, true)
}
