'use strict'

module.exports = {
  loadPriority: %%loadPriority%%,
  startPriority: %%startPriority%%,
  stopPriority: %%stopPriority%%,
  initialize: async function (api) {
    api.%%name%% = {}
  },
  start: async function (api) {},
  stop: async function (api) {}
}
