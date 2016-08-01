'use strict';

var fs = require('fs');

exports.task = function(binary, next){

  if(!binary.argv.name && !binary.argv._[2]){ binary.utils.hardError('name is a required input'); }
  var name = !binary.argv.name ? binary.argv._[2] : binary.argv.name;
  if(!binary.argv.description){ binary.argv.description = name; }
  if(!binary.argv.queue){ binary.argv.queue = 'default'; }
  if(!binary.argv.frequency){ binary.argv.frequency = 0; }

  var data = fs.readFileSync(binary.actionheroRoot + '/bin/templates/task.js');
  data = String(data);

  [
    'name',
    'description',
    'queue',
    'frequency',
  ].forEach(function(v){
    var regex = new RegExp('%%' + v + '%%', 'g');
    if (v === 'name'){
      data = data.replace(regex, name);
    }
    data = data.replace(regex, binary.argv[v]);
  });

  binary.utils.createFileSafely(binary.config.general.paths.task[0] + '/' + name + '.js', data);

  next(true);
};
