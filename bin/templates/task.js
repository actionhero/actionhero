'use strict';

exports.task = {
  name:          '%%name%%',
  description:   '%%description%%',
  frequency:     %%frequency%%,
  queue:         '%%queue%%',
  middleware:    [],

  run: function(api, params, next){
    // your logic here
    next();
  }
};
