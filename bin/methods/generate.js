var fs = require('fs');

exports.generate = function(binary, next){

  //////// DOCUMENTS ////////

  var documents = {};

  documents.projectMap = fs.readFileSync(binary.paths.actionheroRoot + '/bin/templates/projectMap.txt');

  var oldFileMap = {
    configApiJs          : '/config/api.js',
    configPluginsJs      : '/bin/templates/plugins.js',
    configLoggerJs       : '/config/logger.js',
    configRedisJs        : '/config/redis.js',
    configStatsJs        : '/config/stats.js',
    configTasksJs        : '/config/tasks.js',
    configErrorsJs       : '/config/errors.js',
    configRoutesJs       : '/config/routes.js',
    configSocketJs       : '/config/servers/socket.js',
    configWebJs          : '/config/servers/web.js',
    configWebsocketJs    : '/config/servers/websocket.js',
    packageJson          : '/package.json',
    actionStatus         : '/actions/status.js',
    actionDocumentation  : '/actions/showDocumentation.js',
    gruntfile            : '/bin/templates/gruntfile.js',
    publicIndex          : '/public/index.html',
    publicChat           : '/public/chat.html',
    publicLogo           : '/public/logo/actionhero.png',
    publicSky            : '/public/logo/sky.jpg',
    publicCss            : '/public/css/actionhero.css',
    exampleTest          : '/test/template.js.example'
  }
  for(var name in oldFileMap){
    documents[name] = fs.readFileSync(binary.paths.actionheroRoot + oldFileMap[name]);
  }

  var AHversionNumber = JSON.parse(documents.packageJson).version;

  documents.packageJson = String(fs.readFileSync(binary.paths.actionheroRoot + '/bin/templates/package.json'));
  documents.packageJson = documents.packageJson.replace('%%versionNumber%%', AHversionNumber);
  documents.readmeMd    = String(fs.readFileSync(binary.paths.actionheroRoot + '/bin/templates/README.md'));

  // Add plugins (from --plugins argument) to the dedicated plugins config file
  var pluginsArrayContents='';
  if(binary.argv.plugins)
  {
    var pluginsArg=binary.argv.plugins.split(',');

    pluginsArg.forEach(function(dep)
    {
      // if(dep.match(/^ah-.*-plugin$/g)!==null)
      if(typeof(dep)==='string')
      {
        pluginsArrayContents+='"'+dep.trim()+'",\n';
      }
    });

    pluginsArrayContents=pluginsArrayContents.trim();
  }

  documents.configPluginsJs = String(documents.configPluginsJs).replace('\'%%REPLACE%%\'', pluginsArrayContents);

  //////// LOGIC ////////

  binary.log('Generating a new actionhero project...');

  // make directories
  [
    '/actions',
    '/pids',
    '/config',
    '/config/servers',
    '/config/plugins',
    '/initializers',
    '/log',
    '/servers',
    '/public',
    '/public/javascript',
    '/public/css',
    '/public/logo',
    '/tasks',
    '/test'
  ].forEach(function(dir){
    binary.utils.createDirSafely(binary.paths.projectRoot + dir);
  });

  // make files
  var newFileMap = {
    '/config/api.js'                                : 'configApiJs',
    '/config/plugins.js'                            : 'configPluginsJs',
    '/config/logger.js'                             : 'configLoggerJs',
    '/config/redis.js'                              : 'configRedisJs',
    '/config/stats.js'                              : 'configStatsJs',
    '/config/tasks.js'                              : 'configTasksJs',
    '/config/errors.js'                             : 'configErrorsJs',
    '/config/routes.js'                             : 'configRoutesJs',
    '/config/servers/socket.js'                     : 'configSocketJs',
    '/config/servers/web.js'                        : 'configWebJs',
    '/config/servers/websocket.js'                  : 'configWebsocketJs',
    '/package.json'                                 : 'packageJson',
    '/actions/status.js'                            : 'actionStatus',
    '/actions/showDocumentation.js'                 : 'actionDocumentation',
    '/public/index.html'                            : 'publicIndex',
    '/public/chat.html'                             : 'publicChat',
    '/public/css/actionhero.css'                    : 'publicCss',
    '/public/logo/actionhero.png'                   : 'publicLogo',
    '/public/logo/sky.jpg'                          : 'publicSky',
    '/README.md'                                    : 'readmeMd',
    '/gruntfile.js'                                 : 'gruntfile',
    '/test/example.js'                              : 'exampleTest'
  }
  for(var file in newFileMap){
    binary.utils.createFileSafely(binary.paths.projectRoot + file, documents[newFileMap[file]]);
  }

  binary.log('');
  binary.log('Generation Complete.  Your project directory should look like this:\n' + documents.projectMap);
  binary.log('');
  binary.log('you may need to run `npm install` to install some dependancies');
  binary.log('run \'npm start\' to start your server');

  next();

}
