var fs = require('fs');

exports['help'] = function(binary, next){
  var help = fs.readFileSync(binary.paths.actionHero_root + "/bin/methods/help.txt");
  binary.log(help.toString());
  next();
}