'use strict'

exports.randomNumber = {
  name: 'randomNumber',
  description: 'I am an API method which will generate a random number',
  outputExample: {
    randomNumber: 0.123
  },

  run: function (api, data, next) {
    data.response.randomNumber = Math.random()
    data.response.stringRandomNumber = data.connection.localize(['Your random number is {{number}}', {number: Math.random()}])
    next(null)
  }

}
