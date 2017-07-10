'use strict'

var chai = require('chai')
var dirtyChai = require('dirty-chai')
var expect = chai.expect
chai.use(dirtyChai)

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
    before((done) => {
      var sourcePackage = path.normalize(path.join(__dirname, '/../../bin/templates/package.json'))
      var commands = [
        'rm -rf ' + testDir,
        'mkdir ' + testDir,
        'cp ' + sourcePackage + ' ' + testDir + '/package.json'
      ]
      doBash(commands, () => {
        var AHPath = path.normalize(path.join(__dirname, '/../..'))
        fs.readFile(testDir + '/package.json', 'utf8', (error, data) => {
          expect(error).to.be.null()
          var result = data.replace(/%%versionNumber%%/g, 'file:' + AHPath)
          fs.writeFile(testDir + '/package.json', result, 'utf8', () => {
            done()
          })
        })
      })
    })

    it('should have made the test dir', (done) => {
      expect(fs.existsSync(testDir)).to.equal(true)
      expect(fs.existsSync(testDir + '/package.json')).to.equal(true)
      done()
    })

    it('can call npm install in the new project', (done) => {
      doBash([
        'cd ' + testDir,
        'npm install'
      ], (error, data) => {
        expect(error).to.be.null()
        done()
      })
    }).timeout(60000)

    it('can generate a new project', (done) => {
      doBash([
        'cd ' + testDir,
        binary + ' generate'
      ], (error) => {
        expect(error).to.be.null();

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
          'locales/en.json',
          'tasks',
          'test',
          'test/example.js'
        ].forEach((f) => {
          expect(fs.existsSync(testDir + '/' + f)).to.equal(true)
        })

        done()
      })
    }).timeout(10000)

    it('can call the help command', (done) => {
      doBash([
        'cd ' + testDir, binary + ' help'
      ], (error, data) => {
        expect(error).to.be.null()
        expect(data).to.match(/actionhero start cluster/)
        expect(data).to.match(/Binary options:/)
        expect(data).to.match(/actionhero generate server/)
        done()
      })
    })

    it('can call the version command', (done) => {
      doBash([
        'cd ' + testDir, binary + ' version'
      ], (error, data) => {
        expect(error).to.be.null()
        expect(data.trim()).to.equal(pacakgeJSON.version)
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
        expect(error).to.be.null()
        var data = String(fs.readFileSync(testDir + '/actions/myAction.js'))
        expect(data).to.match(/name: 'myAction'/)
        expect(data).to.match(/description: 'my_description'/)
        expect(data).to.match(/next\(error\)/)
        done()
      })
    })

    it('can generate a task', (done) => {
      doBash([
        'cd ' + testDir,
        binary + ' generate task --name=myTask --description=my_description --queue=my_queue --frequency=12345'
      ], (error) => {
        expect(error).to.be.null()
        var data = String(fs.readFileSync(testDir + '/tasks/myTask.js'))
        expect(data).to.match(/name: 'myTask'/)
        expect(data).to.match(/description: 'my_description'/)
        expect(data).to.match(/queue: 'my_queue'/)
        expect(data).to.match(/frequency: 12345/)
        expect(data).to.match(/next\(error, resultLogMessage\)/)
        done()
      })
    })

    it('can generate a cli command', (done) => {
      doBash([
        'cd ' + testDir,
        binary + ' generate cli --name=myCommand --description=my_description --example=my_example'
      ], (error) => {
        expect(error).to.be.null()
        var data = String(fs.readFileSync(testDir + '/bin/myCommand.js'))
        expect(data).to.match(/name: 'myCommand'/)
        expect(data).to.match(/description: 'my_description'/)
        expect(data).to.match(/example: 'my_example'/)
        done()
      })
    })

    it('can generate a server', (done) => {
      doBash([
        'cd ' + testDir,
        binary + ' generate server --name=myServer'
      ], (error) => {
        expect(error).to.be.null()
        var data = String(fs.readFileSync(testDir + '/servers/myServer.js'))
        expect(data).to.match(/canChat: true/)
        expect(data).to.match(/logConnections: true/)
        expect(data).to.match(/logExits: true/)
        expect(data).to.match(/sendWelcomeMessage: true/)
        done()
      })
    })

    it('can generate a initializer', (done) => {
      doBash([
        'cd ' + testDir,
        binary + ' generate initializer --name=myInitializer --stopPriority=123'
      ], (error) => {
        expect(error).to.be.null()
        var data = String(fs.readFileSync(testDir + '/initializers/myInitializer.js'))
        expect(data).to.match(/loadPriority: 1000/)
        expect(data).to.match(/startPriority: 1000/)
        expect(data).to.match(/stopPriority: 123/)
        expect(data).to.match(/initialize: function \(api, next\)/)
        expect(data).to.match(/start: function \(api, next\)/)
        expect(data).to.match(/stop: function \(api, next\)/)
        done()
      })
    })

    it('can call npm test in the new project and not fail', (done) => {
      doBash([
        'cd ' + testDir,
        'npm test'
      ], (error, data) => {
        expect(error).to.be.null()
        done()
      })
    }).timeout(120000)

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
