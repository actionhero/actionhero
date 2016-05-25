'use strict';
var _ = require('lodash');

module.exports = {
  loadPriority:  1000,
  initialize: function(api, next){
    api.demoMiddleware = {
      name: "demoMiddleware",
      priority: 999,
      preProcessor: function(data, next){
        api.log("In Preprocessor!", "info");
        next(null, true);
      },
      postProcessor: function(data, next){
        api.log("In Postprocessor!", "info");
        api.log("Data keys: ", "info", _.keys(data));
        api.log("Worker result", "info", data.worker.result);
        next(null, true);
      }
    };
    api.tasks.addMiddleware(api.demoMiddleware);

    next();
  }
};
