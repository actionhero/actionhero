'use strict';

exports.task = {
  name:          'test',
  description:   'test',
  frequency:     0,
  queue:         'default',
  middleware: ["demoMiddleware"],
  plugins:       [],
  pluginOptions: {},

  run: function(api, params, next){
    // your logic here');
      api.log(["Test task: [%s]", params], "info");

    next(null, {result: "i'm a result!"});
  }
};
