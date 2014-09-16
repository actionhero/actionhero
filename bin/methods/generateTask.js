var fs = require('fs');

exports.generateTask = function(binary, next){

  if(!binary.argv.name){ binary.utils.hardError('name is a required input'); }
  if(!binary.argv.description){ binary.argv.description = binary.argv.name; }
  if(!binary.argv.queue){ binary.argv.queue = 'default' }
  if(!binary.argv.frequency){ binary.argv.frequency = 0 }

  var data = fs.readFileSync(binary.paths.actionheroRoot + '/bin/templates/task.js');
  data = String(data);

  [
    'name',
    'description',
    'queue',
    'frequency',
  ].forEach(function(v){
    var regex = new RegExp('%%' + v + '%%', 'g');
    data = data.replace(regex, binary.argv[v]);
  });

  binary.utils.createFileSafely(binary.paths.config.task + '/' + binary.argv.name + '.js', data);

  next();

}
