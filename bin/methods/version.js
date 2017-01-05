'use strict';

const packageJSON = require(__dirname + '/../../package.json');

module.exports = function(api, next){
  console.log(packageJSON.version);
  next(null, true);
};
