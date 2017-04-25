'use strict'

module.exports = {
  loadPriority: 800,
  startPriority: 800,
  initialize: function (api, next) {
    try{
        next()
    } catch(e) {
        console.dir(e);
        next();
    }
  },

  start: function (api, next) {
    next()
  }
}
