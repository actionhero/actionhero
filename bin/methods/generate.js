'use strict'

const fs = require('fs')
const path = require('path')

module.exports = {
  name: 'generate',
  description: 'will prepare an empty directory with a template ActionHero project',

  run: function (api, data, next) {
    // ////// DOCUMENTS ////////

    let documents = {}

    documents.projectMap = fs.readFileSync(path.join(__dirname, '/../templates/projectMap.txt'))

    const oldFileMap = {
      configApiJs: '/config/api.js',
      configLoggerJs: '/config/logger.js',
      configRedisJs: '/config/redis.js',
      configTasksJs: '/config/tasks.js',
      configErrorsJs: '/config/errors.js',
      configI18nJs: '/config/i18n.js',
      configRoutesJs: '/config/routes.js',
      configSocketJs: '/config/servers/socket.js',
      configWebJs: '/config/servers/web.js',
      configWebsocketJs: '/config/servers/websocket.js',
      packageJson: '/package.json',
      actionStatus: '/actions/status.js',
      actionChatRoom: '/actions/createChatRoom.js',
      actionDocumentation: '/actions/showDocumentation.js',
      publicIndex: '/public/index.html',
      publicChat: '/public/chat.html',
      publicLogo: '/public/logo/actionhero.png',
      publicCss: '/public/css/cosmo.css',
      exampleTest: '/test/template.js.example',
      enLocale: '/locales/en.json'
    }

    for (let name in oldFileMap) {
      documents[name] = fs.readFileSync(path.join(__dirname, '/../../', oldFileMap[name]))
    }

    const AHversionNumber = JSON.parse(documents.packageJson).version

    documents.packageJson = String(fs.readFileSync(path.join(__dirname, '/../templates/package.json')))
    documents.packageJson = documents.packageJson.replace('%%versionNumber%%', AHversionNumber)
    documents.readmeMd = String(fs.readFileSync(path.join(__dirname, '/../templates/README.md')))

    // ////// LOGIC ////////

    api.log('Generating a new actionhero project...');

    // make directories
    [
      '/actions',
      '/pids',
      '/config',
      '/config/servers',
      '/initializers',
      '/log',
      '/locales',
      '/bin',
      '/servers',
      '/public',
      '/public/javascript',
      '/public/css',
      '/public/logo',
      '/tasks',
      '/test'
    ].forEach(function (dir) {
      api.utils.createDirSafely(api.projectRoot + dir)
    })

    // make files
    const newFileMap = {
      '/config/api.js': 'configApiJs',
      '/config/logger.js': 'configLoggerJs',
      '/config/redis.js': 'configRedisJs',
      '/config/tasks.js': 'configTasksJs',
      '/config/errors.js': 'configErrorsJs',
      '/config/i18n.js': 'configI18nJs',
      '/config/routes.js': 'configRoutesJs',
      '/config/servers/socket.js': 'configSocketJs',
      '/config/servers/web.js': 'configWebJs',
      '/config/servers/websocket.js': 'configWebsocketJs',
      '/package.json': 'packageJson',
      '/actions/status.js': 'actionStatus',
      '/actions/createChatRoom.js': 'actionChatRoom',
      '/actions/showDocumentation.js': 'actionDocumentation',
      '/public/index.html': 'publicIndex',
      '/public/chat.html': 'publicChat',
      '/public/css/cosmo.css': 'publicCss',
      '/public/logo/actionhero.png': 'publicLogo',
      '/README.md': 'readmeMd',
      '/test/example.js': 'exampleTest',
      '/locales/en.json': 'enLocale'
    }

    for (let file in newFileMap) {
      api.utils.createFileSafely(api.projectRoot + file, documents[newFileMap[file]])
    }

    api.log('')
    api.log('Generation Complete.  Your project directory should look like this:')

    api.log('')
    documents.projectMap.toString().split('\n').forEach(function (line) {
      api.log(line)
    })

    api.log('You may need to run `npm install` to install some dependancies', 'alert')
    api.log('Run \'npm start\' to start your server')

    next(null, true)
  }
}
