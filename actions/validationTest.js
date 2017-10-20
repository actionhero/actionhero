'use strict'
const {Action} = require('./../index.js')

module.exports = class ValidationTest extends Action {
  constructor () {
    super()
    this.name = 'validationTest'
    this.description = 'I will test action input validators.'
    this.outputExample = {
      string: 'imAString!'
    }
  }

  inputs () {
    return {
      string: {
        required: true,
        validator: param => {
          return typeof param === 'string'
        }
      }
    }
  }

  run ({params, response}) {
    response.string = params.string
  }
}
