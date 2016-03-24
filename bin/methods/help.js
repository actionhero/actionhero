'use strict';

var fs = require('fs');

exports.help = function(binary, next){
  var help = fs.readFileSync(binary.actionheroRoot + '/bin/templates/help.txt');
  binary.log(help.toString());
  next(true);
};
