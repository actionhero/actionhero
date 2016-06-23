'use strict';

var inputs = {
  id: {
    required: true,
  },
  params: {
    required: false
  }
};

exports.action = {
  name: 'loadQueue',
  description: 'loadQueue',
  blockedConnectionTypes: [],
  outputExample: {},
  matchExtensionMimeType: false,
  version: 1.0,
  toDocument: true,
  middleware: [],

  inputs: inputs,

  run: function(api, data, next) {
    var error = null;

    if (api.tasks.tasks[data.params.id]) {
      // enqueue task
      api.tasks.enqueueIn(10000, data.params.id, data.params.params, 'default', (err, toRun) => {
        next(err);
      });

    } else {

      error = new Error("Task not found!");
      next(error);
    }
  }
};
