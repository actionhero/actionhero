exports['generateAction'] = function(binary, next){

  if(binary.argv.name == null){ binary.hardError("name is a required input"); }
  if(binary.argv.description == null){ binary.hardError("description is a required input"); }

  var templateLines = [];
  templateLines.push('var action = {};')
  templateLines.push('')
  templateLines.push('/////////////////////////////////////////////////////////////////////')
  templateLines.push('// metadata')
  templateLines.push('action.name = "'+binary.argv['name']+'";')
  templateLines.push('action.description = "'+binary.argv['description']+'";')
  templateLines.push('action.inputs = {')
  var req = binary.utils.stringifyInputList(binary.argv['inputsRequired']);
  templateLines.push('  "required" : ['+req+'],')
  var optional = binary.utils.stringifyInputList(binary.argv['inputsOptional'])
  templateLines.push('  "optional" : ['+optional+']')
  templateLines.push('};')
  templateLines.push('action.outputExample = {}')
  templateLines.push('')
  templateLines.push('/////////////////////////////////////////////////////////////////////')
  templateLines.push('// functional')
  templateLines.push('action.run = function(api, connection, next){')
  templateLines.push('  // your logic here')
  templateLines.push('  next(connection, true);')
  templateLines.push('}')
  templateLines.push('')
  templateLines.push('/////////////////////////////////////////////////////////////////////')
  templateLines.push('// exports')
  templateLines.push('exports.action = action;')

  var data = "";
  for(var i in templateLines){
    data += templateLines[i] + "\r\n";
  }
  var partialPath = "/actions/" + binary.argv['name'] + ".js";
  binary.utils.create_file_safely(binary.paths.project_root + partialPath, data);

  next();
}