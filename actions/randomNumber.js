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

exports.randomNumberAsync = {
  name: 'randomNumberAsync',
  description: 'I am an API method which will async generate a random number and custom render response',
  outputExample: '0.123',

  run: function (api, data, next) {
    data.toRender = false
    process.nextTick(() => {
      data.connection.rawConnection.res.writeHead(200, { 'Content-Type': 'text/plain' })
      data.connection.rawConnection.res.end(`${Math.random()}`)
      next(null)
    })
  }

}
