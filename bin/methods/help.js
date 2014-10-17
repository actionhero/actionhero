var fs = require('fs');

exports.help = function(binary, next){
  var help = fs.readFileSync(binary.paths.actionheroRoot + '/bin/templates/help.txt');
  binary.log(help.toString());
  next();
}
