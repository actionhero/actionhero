var fs = require('fs');

exports.generateInitializer = function(binary, next){

  if(!binary.argv.name){ binary.utils.hardError('name is a required input'); }

  var data = fs.readFileSync(binary.paths.actionheroRoot + '/bin/templates/initializer.js');
  data = String(data);

  [
    'name',
  ].forEach(function(v){
    var regex = new RegExp('%%' + v + '%%', 'g');
    data = data.replace(regex, binary.argv[v]);
  });
  
  binary.utils.createFileSafely(binary.paths.config.initializer + '/' + binary.argv.name + '.js', data);

  next();

}
