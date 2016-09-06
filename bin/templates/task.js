'use strict';

exports.task = {
  name:          '%%name%%',
  description:   '%%description%%',
  frequency:     %%frequency%%,
  queue:         '%%queue%%',
  plugins:       [],
  pluginOptions: {},

  run: function(api, params, next){
    // your logic here
    next();
  }
};
