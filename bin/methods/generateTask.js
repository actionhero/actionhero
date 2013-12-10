exports['generateTask'] = function(binary, next){

  if(null === binary.argv.name){ binary.utils.hardError('name is a required input') }
  if(null === binary.argv.description){ binary.argv.description = binary.argv.name }
  if(null === binary.argv.queue){ binary.argv.queue = 'default' }
  if(null === binary.argv.frequency){ binary.argv.frequency = 0 }

  var templateLines = [];

  templateLines.push('exports.task = {');
  templateLines.push('  name: \'' + binary.argv['name'] + '\',');
  templateLines.push('  description: "' + binary.argv['description'] + '",');
  templateLines.push('  frequency: ' + binary.argv['frequency'] + ',');
  templateLines.push('  queue: \'' + binary.argv['queue'] + '\',');
  templateLines.push('  plugins: [],');
  templateLines.push('  pluginOptions: {},');
  templateLines.push('  run: function(api, params, next){');
  templateLines.push('    // your logic here');
  templateLines.push('    next();');
  templateLines.push('  }');
  templateLines.push('};');

  var data = '';
  for(var i in templateLines){
    data += templateLines[i] + '\n';
  }

  binary.utils.create_file_safely(binary.paths.config.task + '/' + binary.argv['name'] + '.js', data);

  next();

}
