var fs = require('fs');

exports.generateAction = function(binary, next){

  if(!binary.argv.name){ binary.utils.hardError('name is a required input'); }
  if(!binary.argv.description){ binary.argv.description = binary.argv.name; }
  
  var data = fs.readFileSync(binary.paths.actionheroRoot + '/bin/templates/action.js');
  data = String(data);

  [
    'name',
    'description',
  ].forEach(function(v){
    var regex = new RegExp('%%' + v + '%%', 'g');
    data = data.replace(regex, binary.argv[v]);
  });

  binary.utils.createFileSafely(binary.paths.config.action + '/' + binary.argv.name + '.js', data);

  next();
}
