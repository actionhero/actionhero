'use strict';

exports.task = {
  name:          'hello',
  description:   'hello',
  frequency:     10000,
  queue:         'default',
  plugins:       [],
  pluginOptions: {},

  run: function(api, params, next){
    api.log("hello!");
    next();
  }
};
