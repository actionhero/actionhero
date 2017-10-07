const {CLI} = require('./../../../index.js')

module.exports = class Version extends CLI {
  constructor () {
    super()
    this.name = 'hello'
    this.description = 'I say hello'
  }

  run () {
    console.log('hello')
    return true
  }
}
