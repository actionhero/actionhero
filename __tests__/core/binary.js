'use strict'

// These tests will only run on *nix operating systems

var fs = require('fs')
var os = require('os')
var path = require('path')
var exec = require('child_process').exec
var testDir = os.tmpdir() + path.sep + 'actionheroTestProject'
var binary = './node_modules/.bin/actionhero'
var pacakgeJSON = require(path.join(__dirname, '/../../package.json'))

var doBash = (commands, callback) => {
  var fullCommand = '/bin/bash -c \'' + commands.join(' && ') + '\''
  // console.log(fullCommand)
  exec(fullCommand, (error, stdout, stderr) => {
    callback(error, stdout, stderr)
  })
}

describe('Core: Binary', () => {
  if (process.platform === 'win32') {
    console.log('*** CANNOT RUN BINARY TESTS ON WINDOWS.  Sorry. ***')
  } else {
    beforeAll((done) => {
      var sourcePackage = path.normalize(path.join(__dirname, '/../../bin/templates/package.json'))
      var commands = [
        'rm -rf ' + testDir,
        'mkdir ' + testDir,
        'cp ' + sourcePackage + ' ' + testDir + '/package.json'
      ]
      doBash(commands, () => {
        var AHPath = path.normalize(path.join(__dirname, '/../..'))
        fs.readFile(testDir + '/package.json', 'utf8', (error, data) => {
          expect(error).toBeNull()
          var result = data.replace(/%%versionNumber%%/g, 'file:' + AHPath)
          fs.writeFile(testDir + '/package.json', result, 'utf8', () => {
            done()
          })
        })
      })
    })

    it('should have made the test dir', (done) => {
      expect(fs.existsSync(testDir)).toBe(true)
      expect(fs.existsSync(testDir + '/package.json')).toBe(true)
      done()
    })

    it('can call npm install in the new project', (done) => {
      doBash([
        'cd ' + testDir,
        'npm install'
      ], (error, data) => {
        expect(error).toBeNull()
        done()
      })
    }, 60000)

    it('can generate a new project', (done) => {
      doBash([
        'cd ' + testDir,
        binary + ' generate'
      ], (error) => {
        expect(error).toBeNull();

        [
          'actions',
          'actions/showDocumentation.js',
          'actions/status.js',
          'config',
          'config/api.js',
          'config/errors.js',
          'config/i18n.js',
          'config/logger.js',
          'config/redis.js',
          'config/routes.js',
          'config/servers',
          'config/tasks.js',
          'config/servers/web.js',
          'config/servers/websocket.js',
          'config/servers/socket.js',
          'pids',
          'log',
          'public',
          'public/index.html',
          'public/chat.html',
          'public/css/cosmo.css',
          'public/javascript',
          'public/logo/actionhero.png',
          'servers',
          'tasks',
          '__tests__',
          '__tests__/example.js'
        ].forEach((f) => {
          expect(fs.existsSync(testDir + '/' + f)).toBe(true)
        })

        done()
      })
    }, 10000)

    it('can call the help command', (done) => {
      doBash([
        'cd ' + testDir, binary + ' help'
      ], (error, data) => {
        expect(error).toBeNull()
        expect(data).toMatch(/actionhero start cluster/)
        expect(data).toMatch(/Binary options:/)
        expect(data).toMatch(/actionhero generate server/)
        done()
      })
    })

    it('can call the version command', (done) => {
      doBash([
        'cd ' + testDir, binary + ' version'
      ], (error, data) => {
        expect(error).toBeNull()
        expect(data.trim()).toBe(pacakgeJSON.version)
        done()
      })
    })

    // TODO: Stdout from winston insn't comming though when program exists with error code
    it('will show a warning with bogus input')

    it('can generate an action', (done) => {
      doBash([
        'cd ' + testDir,
        binary + ' generate action --name=myAction --description=my_description'
      ], (error) => {
        expect(error).toBeNull()
        var data = String(fs.readFileSync(testDir + '/actions/myAction.js'))
        expect(data).toMatch(/name: 'myAction'/)
        expect(data).toMatch(/description: 'my_description'/)
        expect(data).toMatch(/next\(error\)/)
        done()
      })
    })

    it('can generate a task', (done) => {
      doBash([
        'cd ' + testDir,
        binary + ' generate task --name=myTask --description=my_description --queue=my_queue --frequency=12345'
      ], (error) => {
        expect(error).toBeNull()
        var data = String(fs.readFileSync(testDir + '/tasks/myTask.js'))
        expect(data).toMatch(/name: 'myTask'/)
        expect(data).toMatch(/description: 'my_description'/)
        expect(data).toMatch(/queue: 'my_queue'/)
        expect(data).toMatch(/frequency: 12345/)
        expect(data).toMatch(/next \(error, resultLogMessage\)/)
        done()
      })
    })

    it('can generate a server', (done) => {
      doBash([
        'cd ' + testDir,
        binary + ' generate server --name=myServer'
      ], (error) => {
        expect(error).toBeNull()
        var data = String(fs.readFileSync(testDir + '/servers/myServer.js'))
        expect(data).toMatch(/canChat: true/)
        expect(data).toMatch(/logConnections: true/)
        expect(data).toMatch(/logExits: true/)
        expect(data).toMatch(/sendWelcomeMessage: true/)
        done()
      })
    })

    it('can generate a initializer', (done) => {
      doBash([
        'cd ' + testDir,
        binary + ' generate initializer --name=myInitializer --stopPriority=123'
      ], (error) => {
        expect(error).toBeNull()
        var data = String(fs.readFileSync(testDir + '/initializers/myInitializer.js'))
        expect(data).toMatch(/loadPriority: 1000/)
        expect(data).toMatch(/startPriority: 1000/)
        expect(data).toMatch(/stopPriority: 123/)
        expect(data).toMatch(/initialize: function \(api, next\)/)
        expect(data).toMatch(/start: function \(api, next\)/)
        expect(data).toMatch(/stop: function \(api, next\)/)
        done()
      })
    })

    describe('can run a single server', () => {
      it('can boot a single server')
      it('can handle signals to reboot')
      it('can handle signals to stop')
      it('will shutdown after the alloted time')
    })

    describe('can run a cluster', () => {
      it('can handle signals to reboot (graceful)')
      it('can handle signals to reboot (hup)')
      it('can handle signals to stop')
      it('can handle signals to add a worker')
      it('can handle signals to remove a worker')
      it('can detect flapping and exit')
      it('can reboot and abosrb code changes without downtime')
    })
  }
})
