'use strict';

exports.action = {
  name:                   'taskRunner',
  description:            'taskRunner',
  blockedConnectionTypes: [],
  outputExample:          {},
  matchExtensionMimeType: false,
  version:                1.0,
  toDocument:             true,
  middleware:             [],

  inputs: {
    task: {
      required: true
    },
    params: {
      required: false
    }
  },

  run: function(api, data, next) {
    if(api.tasks.tasks[data.params.task] !== undefined){
      api.log("Found task. Enqueueing.", "info", data.params);
      api.tasks.enqueue(data.params.task, data.params.params, "default", (error, response) => {
        if (error){
          next(error);
        } else {
          api.log("Task enqueued.", "info", response);
          next();
        }
      })
    } else {
      next(new Error("Task not found!"));
    }
  }
};
