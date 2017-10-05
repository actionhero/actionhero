'use strict'

const fs = require('fs')
const path = require('path')
const ActionHero = require('./../../index.js')
const api = ActionHero.api

module.exports = class Generate extends ActionHero.CLI {
  constructor () {
    super()
    this.name = 'generate'
    this.description = 'will prepare an empty directory with a template ActionHero project'
  }

  run () {
    let documents = {}

    documents.projectMap = fs.readFileSync(path.join(__dirname, '/../templates/projectMap.txt'))

    const oldFileMap = {
      configApiJs: '/config/api.js',
      configLoggerJs: '/config/logger.js',
      configRedisJs: '/config/redis.js',
      configTasksJs: '/config/tasks.js',
      configErrorsJs: '/config/errors.js',
      configPluginsJs: '/config/plugins.js',
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
      let localPath = oldFileMap[name]
      let source = path.join(__dirname, '/../../', localPath)
      let extension = (localPath.split('.'))[1]
      documents[name] = fs.readFileSync(source)
      if (extension === 'js' || extension === 'json') {
        documents[name] = documents[name].toString()
        documents[name] = documents[name].replace('require(\'./../index.js\')', 'require(\'actionhero\')')
      }
    }

    const AHversionNumber = JSON.parse(documents.packageJson).version

    documents.packageJson = String(fs.readFileSync(path.join(__dirname, '/../templates/package.json')))
    documents.packageJson = documents.packageJson.replace('%%versionNumber%%', AHversionNumber)
    documents.readmeMd = String(fs.readFileSync(path.join(__dirname, '/../templates/README.md')))

    console.log('Generating a new actionhero project...');

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
    ].forEach((dir) => {
      try {
        let message = api.utils.createDirSafely(api.projectRoot + dir)
        console.log(message)
      } catch (error) {
        console.log(error.toString())
      }
    })

    const newFileMap = {
      '/config/api.js': 'configApiJs',
      '/config/logger.js': 'configLoggerJs',
      '/config/redis.js': 'configRedisJs',
      '/config/tasks.js': 'configTasksJs',
      '/config/errors.js': 'configErrorsJs',
      '/config/plugins.js': 'configPluginsJs',
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
      try {
        let message = api.utils.createFileSafely(api.projectRoot + file, documents[newFileMap[file]])
        console.log(message)
      } catch (error) {
        console.log(error.toString())
      }
    }

    console.log('')
    console.log('Generation Complete.  Your project directory should look like this:')

    console.log('')
    documents.projectMap.toString().split('\n').forEach(function (line) {
      console.log(line)
    })

    console.log('You may need to run `npm install` to install some dependancies', 'alert')
    console.log('Run \'npm start\' to start your server')

    return true
  }
}
