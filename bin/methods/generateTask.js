exports['generateTask'] = function(binary, next){

  if(binary.argv.name == null){ binary.utils.hardError("name is a required input"); }
  if(binary.argv.description == null){ binary.argv.description = binary.argv.name; }
  if(binary.argv.queue == null){ binary.argv.queue = "defualt"; }
  if(binary.argv.frequency == null){ binary.argv.frequency = 0; }

  var templateLines = [];

  templateLines.push('exports.task = {');
  templateLines.push('  name: "' + binary.argv['name'] + '",');
  templateLines.push('  description: "' + binary.argv['description'] + '",');
  templateLines.push('  queue: "' + binary.argv['queue'] + '",');
  templateLines.push('  frequency: ' + binary.argv['frequency'] + ',');
  templateLines.push('  run: function(api, params, next){');
  templateLines.push('    // your logic here');
  templateLines.push('    next();');
  templateLines.push('  }');
  templateLines.push('};');

  var data = "";
  for(var i in templateLines){
    data += templateLines[i] + "\n";
  }
  var partialPath = "/tasks/" + binary.argv['name'] + ".js";
  binary.utils.create_file_safely( binary.paths.project_root + partialPath, data);

  next();

}