'use strict';

var fs = require('fs');

module.exports = function(api, next){
  var help = fs.readFileSync(__dirname + '/../templates/help.txt').toString();
  help.split('\n').forEach(function(line){ console.log(line); });
  next(null, true);
};
