exports['generateTask'] = function(binary, next){

  if(binary.argv.name == null){ binary.utils.hardError("name is a required input"); }
  if(binary.argv.description == null){ binary.argv.description = binary.argv.name; }
  if(binary.argv.scope == null){ binary.argv.scope = "any"; }
  if(binary.argv.frequency == null){ binary.argv.frequency = 0; }
  if(binary.argv.toAnnounce == null){ binary.argv.toAnnounce = 'true'; }

  var templateLines = [];

  templateLines.push('exports.task = {');
  templateLines.push('  name: "' + binary.argv['name'] + '",');
  templateLines.push('  description: "' + binary.argv['description'] + '",');
  templateLines.push('  scope: "' + binary.argv['scope'] + '",');
  templateLines.push('  frequency: ' + binary.argv['frequency'] + ',');
  templateLines.push('  toAnnounce: ' + binary.argv['toAnnounce'] + ',');
  templateLines.push('  run: function(api, params, next){');
  templateLines.push('    if(params == null){ prams = {}; }');
  templateLines.push('    var error = null;');
  templateLines.push('    // your logic here');
  templateLines.push('    next(error, true);');
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