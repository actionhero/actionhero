'use strict';

var fs = require('fs');

exports.generate = function(binary, next){

  //////// DOCUMENTS ////////

  var documents = {};

  documents.projectMap = fs.readFileSync(binary.actionheroRoot + '/bin/templates/projectMap.txt');

  var oldFileMap = {
    configApiJs         : '/config/api.js',
    configLoggerJs      : '/config/logger.js',
    configRedisJs       : '/config/redis.js',
    configTasksJs       : '/config/tasks.js',
    configErrorsJs      : '/config/errors.js',
    configI18nJs        : '/config/i18n.js',
    configRoutesJs      : '/config/routes.js',
    configSocketJs      : '/config/servers/socket.js',
    configWebJs         : '/config/servers/web.js',
    configWebsocketJs   : '/config/servers/websocket.js',
    packageJson         : '/package.json',
    actionStatus        : '/actions/status.js',
    actionChatRoom      : '/actions/createChatRoom.js',
    actionDocumentation : '/actions/showDocumentation.js',
    publicIndex         : '/public/index.html',
    publicChat          : '/public/chat.html',
    publicLogo          : '/public/logo/actionhero.png',
    publicSky           : '/public/logo/sky.jpg',
    publicCss           : '/public/css/actionhero.css',
    exampleTest         : '/test/template.js.example'
  };
  for(var name in oldFileMap){
    documents[name] = fs.readFileSync(binary.actionheroRoot + oldFileMap[name]);
  }

  var AHversionNumber = JSON.parse(documents.packageJson).version;

  documents.packageJson = String(fs.readFileSync(binary.actionheroRoot + '/bin/templates/package.json'));
  documents.packageJson = documents.packageJson.replace('%%versionNumber%%', AHversionNumber);
  documents.readmeMd    = String(fs.readFileSync(binary.actionheroRoot + '/bin/templates/README.md'));

  //////// LOGIC ////////

  binary.log('Generating a new actionhero project...');

  // make directories
  [
    '/actions',
    '/pids',
    '/config',
    '/config/servers',
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
    binary.utils.createDirSafely(binary.projectRoot + dir);
  });

  // make files
  var newFileMap = {
    '/config/api.js'                                : 'configApiJs',
    '/config/logger.js'                             : 'configLoggerJs',
    '/config/redis.js'                              : 'configRedisJs',
    '/config/tasks.js'                              : 'configTasksJs',
    '/config/errors.js'                             : 'configErrorsJs',
    '/config/i18n.js'                               : 'configI18nJs',
    '/config/routes.js'                             : 'configRoutesJs',
    '/config/servers/socket.js'                     : 'configSocketJs',
    '/config/servers/web.js'                        : 'configWebJs',
    '/config/servers/websocket.js'                  : 'configWebsocketJs',
    '/package.json'                                 : 'packageJson',
    '/actions/status.js'                            : 'actionStatus',
    '/actions/createChatRoom.js'                    : 'actionChatRoom',
    '/actions/showDocumentation.js'                 : 'actionDocumentation',
    '/public/index.html'                            : 'publicIndex',
    '/public/chat.html'                             : 'publicChat',
    '/public/css/actionhero.css'                    : 'publicCss',
    '/public/logo/actionhero.png'                   : 'publicLogo',
    '/public/logo/sky.jpg'                          : 'publicSky',
    '/README.md'                                    : 'readmeMd',
    '/test/example.js'                              : 'exampleTest'
  };
  for(var file in newFileMap){
    binary.utils.createFileSafely(binary.projectRoot + file, documents[newFileMap[file]]);
  }

  binary.log('');
  binary.log('Generation Complete.  Your project directory should look like this:\n' + documents.projectMap);
  binary.log('');
  binary.log('you may need to run `npm install` to install some dependancies', 'alert');
  binary.log('run \'npm start\' to start your server');

  next(true);
};
