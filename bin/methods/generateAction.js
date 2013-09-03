exports['generateAction'] = function(binary, next){

  if(binary.argv.name == null){ binary.utils.hardError("name is a required input"); }
  if(binary.argv.description == null){ binary.argv.description = binary.argv.name; }

  var req = binary.utils.stringifyInputList(binary.argv['inputsRequired']);
  var optional = binary.utils.stringifyInputList(binary.argv['inputsOptional']);
  var templateLines = [];

  templateLines.push('exports.action = {');
  templateLines.push('  name: "' + binary.argv['name'] + '",');
  templateLines.push('  description: "' + binary.argv['description'] + '",');
  templateLines.push('  inputs: {');
  templateLines.push('    required: [' + req + '],');
  templateLines.push('    optional: [' + optional + '],');
  templateLines.push('  },');
  templateLines.push('  blockedConnectionTypes: [],');
  templateLines.push('  outputExample: {},');
  templateLines.push('  version: 1.0,');
  templateLines.push('  run: function(api, connection, next){');
  templateLines.push('    // your logic here');
  templateLines.push('    next(connection, true);');
  templateLines.push('  }');
  templateLines.push('};');

  var data = "";
  for(var i in templateLines){
    data += templateLines[i] + "\n";
  }
  var partialPath = "/actions/" + binary.argv['name'] + ".js";
  binary.utils.create_file_safely(binary.paths.project_root + partialPath, data);

  next();
}