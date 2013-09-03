exports['generateInitializer'] = function(binary, next){

  if(binary.argv.name == null){ binary.utils.hardError("name is a required input"); }

  var templateLines = [];
  templateLines.push('exports.'+binary.argv['name']+' = function(api, next){');
  templateLines.push('');
  templateLines.push('  // modify / append the api global variable');
  templateLines.push('  // I will be run as part of actionHero\'s boot process');
  templateLines.push('');
  templateLines.push('  next();');
  templateLines.push('}');

  var data = "";
  for(var i in templateLines){
    data += templateLines[i] + "\n";
  }
  var partialPath = "/initializers/" + binary.argv['name'] + ".js";
  binary.utils.create_file_safely(binary.paths.project_root + partialPath, data);

  next();

}