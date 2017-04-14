'use strict'

module.exports = {
  loadPriority: %%loadPriority%%,
  startPriority: %%startPriority%%,
  stopPriority: %%stopPriority%%,
  initialize: function (api, next) {
    api.%%name%% = {}

    return next()
  },
  start: function (api, next) {
    return next()
  },
  stop: function (api, next) {
    return next()
  }
}
