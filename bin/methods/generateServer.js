exports['generateServer'] = function(binary, next){

  if(binary.argv.name == null){ binary.utils.hardError("name is a required input"); }

  var templateLines = [];
  templateLines.push('var ' + binary.argv['name'] + ' = function(api, options, next){');
  templateLines.push('');
  templateLines.push('  //////////');
  templateLines.push('  // INIT //');
  templateLines.push('  //////////');
  templateLines.push('');
  templateLines.push('  var type = "' + binary.argv['name'] + '"');
  templateLines.push('  var attributes = {');
  templateLines.push('    canChat: true,');
  templateLines.push('    logConnections: true,');
  templateLines.push('    logExits: true,');
  templateLines.push('    sendWelcomeMessage: true,');
  templateLines.push('    verbs: [],');
  templateLines.push('  }');
  templateLines.push('');
  templateLines.push('  var server = new api.genericServer(type, options, attributes);');
  templateLines.push('');
  templateLines.push('  //////////////////////');
  templateLines.push('  // REQUIRED METHODS //');
  templateLines.push('  //////////////////////');
  templateLines.push('');
  templateLines.push('  server._start = function(next){}');
  templateLines.push('');
  templateLines.push('  server._teardown = function(next){}');
  templateLines.push('');
  templateLines.push('  server.sendMessage = function(connection, message, messageCount){}');
  templateLines.push('');
  templateLines.push('  server.sendFile = function(connection, error, fileStream, mime, length){};');
  templateLines.push('');
  templateLines.push('  server.goodbye = function(connection, reason){};');
  templateLines.push('');
  templateLines.push('  ////////////');
  templateLines.push('  // EVENTS //');
  templateLines.push('  ////////////');
  templateLines.push('');
  templateLines.push('  server.on("connection", function(connection){});');
  templateLines.push('');
  templateLines.push('  server.on("actionComplete", function(connection, toRender, messageCount){});');
  templateLines.push('');
  templateLines.push('  /////////////');
  templateLines.push('  // HELPERS //');
  templateLines.push('  /////////////');
  templateLines.push('');
  templateLines.push('  next(server);');
  templateLines.push('}');
  templateLines.push('');
  templateLines.push('/////////////////////////////////////////////////////////////////////');
  templateLines.push('// exports');
  templateLines.push('exports.' + binary.argv['name'] + ' = ' + binary.argv['name'] + ';');


  var data = "";
  for(var i in templateLines){
    data += templateLines[i] + "\n";
  }
  var partialPath = "/servers/" + binary.argv['name'] + ".js";
  binary.utils.create_file_safely(binary.paths.project_root + partialPath, data);

  next();

}