'use strict';

module.exports = {
  loadPriority:  %%loadPriority%%,
  startPriority: %%startPriority%%,
  stopPriority:  %%stopPriority%%,
  initialize: function(api, next){
    api.%%name%% = {};

    next();
  },
  start: function(api, next){
    next();
  },
  stop: function(api, next){
    next();
  }
};
