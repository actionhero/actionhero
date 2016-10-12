'use strict';

module.exports = function(api, next){
  const packageJSON = require(__dirname + '/../../package.json');
  console.log(packageJSON.version);
  next(null, true);
};
