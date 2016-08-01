'use strict';

var fs = require('fs');

exports.initializer = function(binary, next){

  if(!binary.argv.name && !binary.argv._[2]){ binary.utils.hardError('name is a required input'); }

  var name = !binary.argv.name ? binary.argv._[2] : binary.argv.name;
  var data = fs.readFileSync(binary.actionheroRoot + '/bin/templates/initializer.js');
  data = String(data);

  [
    'name',
  ].forEach(function(v){
    var regex = new RegExp('%%' + v + '%%', 'g');
    if (v === 'name'){
      data = data.replace(regex, name);
    }
    data = data.replace(regex, binary.argv[v]);
  });

  binary.utils.createFileSafely(binary.config.general.paths.initializer[0] + '/' + name + '.js', data);

  next(true);
};
