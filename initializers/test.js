'use strict'

module.exports = {
  loadPriority: 900,
  startPriority: 900,
  initialize: function (api, next) {
    a=b;
    next()
  },

  start: function (api, next) {
    next()
  }
}
