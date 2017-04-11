'use strict'

const fs = require('fs')
const path = require('path')

module.exports = {
  name: 'help',
  description: 'get actonhero CLI help',

  run: function (api, data, next) {
    const help = fs.readFileSync(path.join(__dirname, '/../templates/help.txt')).toString()
    help.split('\n').forEach(function (line) { console.log(line) })
    next(null, true)
  }
}
