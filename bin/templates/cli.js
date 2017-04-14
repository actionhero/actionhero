'use strict'

module.exports = {
  name: '%%name%%',
  description: '%%description%%',
  example: '%%example%%',

  inputs: {},

  run: function (api, data, next) {
    return next(null, true)
  }
}
