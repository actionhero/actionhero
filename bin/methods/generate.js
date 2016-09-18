'use strict';

var fs   = require('fs');
var path = require('path');

module.exports = function(api, next){
  // proxy the logger, as we can't use the real one yet
  api.log = function(message){
    console.log(message);
  };

  // reload utils, as they won't have been loaded yet
  api.utils = require(path.normalize(__dirname + '/../../initializers/utils.js')).initialize(api, function(error){
    if(error){ return next(error); }

    //////// DOCUMENTS ////////

    var documents = {};

    documents.projectMap = fs.readFileSync(__dirname + '/../templates/projectMap.txt');

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
      documents[name] = fs.readFileSync(__dirname + '/../../' + oldFileMap[name]);
    }

    var AHversionNumber = JSON.parse(documents.packageJson).version;

    documents.packageJson = String(fs.readFileSync(__dirname + '/../templates/package.json'));
    documents.packageJson = documents.packageJson.replace('%%versionNumber%%', AHversionNumber);
    documents.readmeMd    = String(fs.readFileSync(__dirname + '/../templates/README.md'));

    //////// LOGIC ////////

    api.log('Generating a new actionhero project...');

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
      api.utils.createDirSafely(api.projectRoot + dir);
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
      api.utils.createFileSafely(api.projectRoot + file, documents[newFileMap[file]]);
    }

    api.log('');
    api.log('Generation Complete.  Your project directory should look like this:');

    api.log('');
    documents.projectMap.toString().split('\n').forEach(function(line){
      api.log(line);
    });

    api.log('You may need to run `npm install` to install some dependancies', 'alert');
    api.log('Run \'npm start\' to start your server');

    next(null, true);
  });
};
