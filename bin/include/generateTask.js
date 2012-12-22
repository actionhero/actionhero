exports['generateTask'] = function(binary, next){

  if(binary.argv.name == null){ binary.hardError("name is a required input"); }
  if(binary.argv.description == null){ binary.hardError("description is a required input"); }
  if(binary.argv.scope == null){ binary.argv.scope = "any"; }
  if(binary.argv.frequency == null){ binary.argv.frequency = 0; }

  var templateLines = [];
  templateLines.push('var task = {};')
  templateLines.push('')
  templateLines.push('/////////////////////////////////////////////////////////////////////')
  templateLines.push('// metadata')
  templateLines.push('task.name = "'+binary.argv['name']+'";')
  templateLines.push('task.description = "'+binary.argv['description']+'";')
  templateLines.push('task.scope = "'+binary.argv['scope']+'";')
  templateLines.push('task.frequency = '+binary.argv['frequency']+';')
  templateLines.push('')
  templateLines.push('/////////////////////////////////////////////////////////////////////')
  templateLines.push('// functional')
  templateLines.push('task.run = function(api, params, next){')
  templateLines.push('  if(params == null){ prams = {}; }')
  templateLines.push('  var error = null;')
  templateLines.push('  // your logic here')
  templateLines.push('')
  templateLines.push('  next(error, true);')
  templateLines.push('};')
  templateLines.push('')
  templateLines.push('/////////////////////////////////////////////////////////////////////')
  templateLines.push('// exports')
  templateLines.push('exports.task = task;')

  var data = "";
  for(var i in templateLines){
    data += templateLines[i] + "\r\n";
  }
  var partialPath = "/tasks/" + binary.argv['name'] + ".js";
  binary.utils.create_file_safely( binary.paths.project_root + partialPath, data);

  next();

}