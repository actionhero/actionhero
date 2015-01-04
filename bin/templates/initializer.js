module.exports = {
  loadPriority:  1000,
  startPriority: 1000,
  stopPriority:  1000,
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
}