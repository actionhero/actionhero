'use strict'
const {Action} = require('./../index.js')

module.exports = class RandomNumber extends Action {
  constructor () {
    super()
    this.name = 'randomNumber'
    this.description = 'I am an API method which will generate a random number'
    this.outputExample = { randomNumber: 0.123 }
  }

  async run ({connection, response}) {
    response.randomNumber = Math.random()
    response.stringRandomNumber = connection.localize(['Your random number is {{number}}', {number: Math.random()}])
  }
}
